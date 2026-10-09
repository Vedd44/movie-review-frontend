const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createAdminEmailStore } = require('./adminEmailStore');

const emailId = randomUUID();
const token = randomUUID();
const outgoingId = randomUUID();
const hash = 'a'.repeat(64);
const otherHash = 'b'.repeat(64);

test('store passes only identifiers, hashes and safe codes to atomic RPCs', async () => {
  const calls = [];
  const store = createAdminEmailStore({ rpc: async (name, args) => {
    calls.push({ name, args });
    const status = name === 'admin_email_claim' ? 'claimed'
      : name === 'admin_email_prepare' ? 'ready'
        : args.p_action === 'retry' ? 'released' : args.p_action;
    return { data: { status, ignoredExtraField: 'not returned' } };
  } });
  assert.deepEqual(await store.claim(emailId, token), { status: 'claimed' });
  assert.deepEqual(await store.prepare(emailId, token, hash), { status: 'ready' });
  assert.deepEqual(await store.sent(emailId, token, outgoingId), { status: 'sent' });
  assert.deepEqual(await store.retry(emailId, token, 'provider_unavailable'), { status: 'released' });
  assert.deepEqual(await store.ignore(emailId, token, 'loop_detected'), { status: 'ignored' });
  assert.deepEqual(await store.review(emailId, token, 'attachment_too_large'), { status: 'review_required' });
  assert.deepEqual(calls, [
    { name: 'admin_email_claim', args: { p_email_id: emailId, p_token: token } },
    { name: 'admin_email_prepare', args: { p_email_id: emailId, p_token: token, p_payload_hash: hash } },
    ...[
      ['sent', outgoingId, null], ['retry', null, 'provider_unavailable'],
      ['ignored', null, 'loop_detected'], ['review_required', null, 'attachment_too_large'],
    ].map(([action, outgoing, code]) => ({ name: 'admin_email_finish', args: {
      p_email_id: emailId, p_token: token, p_action: action, p_outgoing_email_id: outgoing, p_code: code,
    } })),
  ]);
});

test('store rejects non-metadata inputs before making a database call', () => {
  const store = createAdminEmailStore({ rpc: () => assert.fail('invalid input reached database') });
  assert.throws(() => store.claim('private@example.com', token), /forwarding_store_invalid_identity/);
  assert.throws(() => store.claim(emailId, { toString: () => token }), /forwarding_store_invalid_identity/);
  assert.throws(() => store.prepare(emailId, token, 'email body'), /forwarding_store_invalid_hash/);
  assert.throws(() => store.sent(emailId, token, null), /forwarding_store_invalid_identity/);
  assert.throws(() => store.retry(emailId, token, 'Error sending private@example.com'), /forwarding_store_invalid_code/);
  assert.throws(() => store.review(emailId, token, null), /forwarding_store_invalid_code/);
});

test('database failures and malformed responses fail closed without exposing error content', async () => {
  const privateDetail = 'Private subject / sensitive provider response';
  for (const rpc of [
    async () => { throw new Error(privateDetail); },
    async () => ({ error: { message: privateDetail, details: privateDetail } }),
    async () => ({ data: { status: privateDetail } }),
    async () => ({ data: null }),
  ]) {
    await assert.rejects(createAdminEmailStore({ rpc }).claim(emailId, token), error => {
      assert.match(error.code, /^forwarding_store_(unavailable|invalid_response)$/);
      assert.equal(error.message.includes(privateDetail), false);
      assert.equal(error.cause, undefined);
      return true;
    });
  }
  await assert.rejects(createAdminEmailStore({ rpc: async () => ({ data: { status: 'released' } }) })
    .sent(emailId, token, outgoingId), /forwarding_store_invalid_response/);
});

// Real PostgreSQL-engine checks using a development-only dependency.
// PGlite serializes connections. Overlapping calls below exercise atomic claims,
// but independent-session lock contention must also be checked on staging.
test('PostgreSQL ledger state machine, constraints and permissions', async t => {
  const { PGlite } = require('@electric-sql/pglite');
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const migration = readFileSync(join(__dirname, '../scripts/supabase_admin_email_forwarding.sql'), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // Installation is safely rerunnable without deleting ledger data.

  const store = createAdminEmailStore({ rpc: async (name, args) => {
    const allowed = ['admin_email_claim', 'admin_email_prepare', 'admin_email_finish'];
    assert.ok(allowed.includes(name));
    const parameters = Object.keys(args).map((key, index) => `${key} => $${index + 1}`).join(', ');
    const result = await db.query(`select public.${name}(${parameters}) as result`, Object.values(args));
    return { data: result.rows[0].result };
  } });
  const row = async id => (await db.query('select * from public.admin_email_forwarding where email_id = $1', [id])).rows[0];
  const expire = id => db.query("update public.admin_email_forwarding set lease_until = clock_timestamp() - interval '1 second' where email_id = $1", [id]);

  await t.test('overlapping duplicate claims admit one worker and lease recovery fences the old worker', async () => {
    const id = randomUUID();
    const tokens = Array.from({ length: 8 }, () => randomUUID());
    const results = await Promise.all(tokens.map(lease => store.claim(id, lease)));
    assert.equal(results.filter(result => result.status === 'claimed').length, 1);
    assert.equal(results.filter(result => result.status === 'busy').length, 7);
    const owner = tokens[results.findIndex(result => result.status === 'claimed')];
    const remaining = new Date((await row(id)).lease_until).getTime() - Date.now();
    assert.ok(remaining > 115000 && remaining <= 120000);
    await expire(id);
    assert.deepEqual(await store.prepare(id, owner, hash), { status: 'busy' });
    const newOwner = randomUUID();
    assert.deepEqual(await store.claim(id, newOwner), { status: 'claimed' });
    const before = await row(id);
    for (const result of [
      await store.prepare(id, owner, hash), await store.sent(id, owner, outgoingId),
      await store.retry(id, owner, 'provider_unavailable'), await store.ignore(id, owner, 'loop_detected'),
      await store.review(id, owner, 'attachment_too_large'),
    ]) assert.deepEqual(result, { status: 'busy' });
    assert.deepEqual(await row(id), before);
  });

  await t.test('retries before any send never consume the idempotency window', async () => {
    const id = randomUUID();
    for (let attempt = 0; attempt < 3; attempt++) {
      const lease = randomUUID();
      assert.deepEqual(await store.claim(id, lease), { status: 'claimed' });
      assert.deepEqual(await store.retry(id, lease, 'receive_unavailable'), { status: 'released' });
      await db.query("update public.admin_email_forwarding set created_at = clock_timestamp() - interval '30 days' where email_id = $1", [id]);
    }
    assert.equal((await row(id)).first_send_at, null);
    assert.deepEqual(await store.claim(id, randomUUID()), { status: 'claimed' });
  });

  await t.test('send retries preserve hash and first-send timestamp; changed payload requires review', async () => {
    const id = randomUUID();
    const firstLease = randomUUID();
    await store.claim(id, firstLease);
    assert.deepEqual(await store.prepare(id, firstLease, hash), { status: 'ready' });
    const firstSend = (await row(id)).first_send_at;
    await store.retry(id, firstLease, 'send_timeout');
    const secondLease = randomUUID();
    await store.claim(id, secondLease);
    assert.deepEqual(await store.prepare(id, secondLease, hash), { status: 'ready' });
    assert.deepEqual((await row(id)).first_send_at, firstSend);
    assert.deepEqual(await store.prepare(id, secondLease, otherHash), { status: 'review_required' });
    const result = await row(id);
    assert.equal(result.payload_sha256, hash);
    assert.equal(result.last_error_code, 'payload_changed');
    assert.equal(result.lease_token, null);
    assert.deepEqual(await store.claim(id, randomUUID()), { status: 'review_required' });
  });

  await t.test('claim and prepare both stop sends after 23 hours', async () => {
    for (const boundary of ['claim', 'prepare']) {
      const id = randomUUID();
      const lease = randomUUID();
      await store.claim(id, lease);
      await store.prepare(id, lease, hash);
      await db.query("update public.admin_email_forwarding set first_send_at = clock_timestamp() - interval '23 hours 1 second' where email_id = $1", [id]);
      if (boundary === 'claim') await store.retry(id, lease, 'send_timeout');
      const result = boundary === 'claim' ? await store.claim(id, randomUUID()) : await store.prepare(id, lease, hash);
      assert.deepEqual(result, { status: 'review_required' });
      assert.equal((await row(id)).last_error_code, 'idempotency_window_expired');
    }
  });

  await t.test('sent and ignored rows remain immutable across late webhook deliveries', async () => {
    for (const state of ['sent', 'ignored']) {
      const id = randomUUID();
      const lease = randomUUID();
      await store.claim(id, lease);
      if (state === 'sent') {
        await store.prepare(id, lease, hash);
        assert.deepEqual(await store.sent(id, lease, outgoingId), { status: state });
        await db.query("update public.admin_email_forwarding set first_send_at = clock_timestamp() - interval '2 years' where email_id = $1", [id]);
      } else assert.deepEqual(await store.ignore(id, lease, 'loop_detected'), { status: state });
      const before = await row(id);
      assert.deepEqual(await store.claim(id, randomUUID()), { status: state });
      assert.deepEqual(await store.retry(id, lease, 'send_timeout'), { status: state });
      assert.deepEqual(await store.review(id, lease, 'invalid_payload'), { status: state });
      assert.deepEqual(await row(id), before);
    }
  });

  await t.test('constraints reject unprepared sends and malformed metadata', async () => {
    const id = randomUUID();
    const lease = randomUUID();
    await store.claim(id, lease);
    await assert.rejects(store.sent(id, lease, outgoingId), /forwarding_store_unavailable/);
    assert.equal((await row(id)).state, 'pending');
    for (const sql of [
      "update public.admin_email_forwarding set state = 'sent' where email_id = $1",
      "update public.admin_email_forwarding set payload_sha256 = 'not a hash' where email_id = $1",
      "update public.admin_email_forwarding set lease_until = null where email_id = $1",
      "update public.admin_email_forwarding set last_error_code = 'Private email content' where email_id = $1",
    ]) await assert.rejects(db.query(sql, [id]));
    assert.deepEqual(await store.review(id, lease, 'attachment_too_large'), { status: 'review_required' });
  });

  await t.test('anonymous and authenticated roles cannot access the ledger or RPCs', async () => {
    const security = await db.query("select relrowsecurity from pg_class where oid = 'public.admin_email_forwarding'::regclass");
    assert.equal(security.rows[0].relrowsecurity, true);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      try {
        await assert.rejects(db.query('select * from public.admin_email_forwarding'), /permission denied/);
        await assert.rejects(db.query('select public.admin_email_claim($1, $2)', [randomUUID(), randomUUID()]), /permission denied/);
        await assert.rejects(db.query('select public.admin_email_prepare($1, $2, $3)', [randomUUID(), randomUUID(), hash]), /permission denied/);
        await assert.rejects(db.query("select public.admin_email_finish($1, $2, 'retry', null, 'send_timeout')", [randomUUID(), randomUUID()]), /permission denied/);
      } finally { await db.exec('reset role'); }
    }
    await db.exec('set role service_role');
    try {
      const id = randomUUID();
      const lease = randomUUID();
      assert.deepEqual(await store.claim(id, lease), { status: 'claimed' });
      assert.deepEqual(await store.prepare(id, lease, hash), { status: 'ready' });
      assert.deepEqual(await store.sent(id, lease, outgoingId), { status: 'sent' });
      assert.equal((await row(id)).state, 'sent');
      await assert.rejects(db.query('delete from public.admin_email_forwarding where email_id = $1', [id]), /permission denied/);
    } finally { await db.exec('reset role'); }
  });
});
