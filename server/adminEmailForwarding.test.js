const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { Readable } = require('node:stream');
const { Resend } = require('resend');
const { createAdminEmailHandler, mailbox, providerCall, MAX_WEBHOOK_BYTES } = require('./adminEmailForwarding');

const EMAIL_ID = '12345678-1234-4321-8765-123456789abc';
const SENT_ID = '87654321-4321-4321-8765-123456789abc';
const ATTACHMENT_A = 'aaaaaaaa-1234-4321-8765-123456789abc';
const ATTACHMENT_B = 'bbbbbbbb-1234-4321-8765-123456789abc';
const ADMIN = 'admin@reelbot.movie';
const DESTINATION = 'administrator@gmail.com';
const SECRET_BYTES = Buffer.from('unit-test-signing-secret-not-a-live-credential');
const SECRET = `whsec_${SECRET_BYTES.toString('base64')}`;
const verifier = new Resend('re_unit_test_no_external_calls');
const env = {
  ADMIN_EMAIL_FORWARDING_ENABLED: 'true',
  ADMIN_EMAIL_TO: DESTINATION,
  RESEND_INBOUND_API_KEY: 're_unit_test_no_external_calls',
  RESEND_WEBHOOK_SECRET: SECRET,
  VERCEL_ENV: 'production',
};

function event(overrides = {}) {
  return {
    type: 'email.received',
    created_at: '2026-10-09T12:00:00.000Z',
    data: { email_id: EMAIL_ID, from: 'author@example.org', to: [ADMIN], cc: [], bcc: [], ...overrides },
  };
}

function original(overrides = {}) {
  return {
    id: EMAIL_ID,
    from: 'author@example.org',
    to: [ADMIN], cc: [], bcc: [], reply_to: [],
    created_at: '2026-10-09T12:00:00.000Z',
    subject: 'Private project discussion',
    text: 'Private email contents',
    html: '<p>Private email contents</p>',
    headers: { from: 'Example Author <author@example.org>' },
    authentication: { dmarc: 'pass' },
    attachments: [],
    ...overrides,
  };
}

function signedRequest(value, options = {}) {
  const raw = options.raw ?? JSON.stringify(value);
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
  const id = options.id ?? 'msg_unit_test_delivery';
  const signature = createHmac('sha256', SECRET_BYTES).update(`${id}.${timestamp}.${raw}`).digest('base64');
  const req = Readable.from(options.chunks ?? [Buffer.from(raw)]);
  req.method = options.method ?? 'POST';
  req.headers = {
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`,
    ...options.headers,
  };
  return req;
}

function response() {
  return {
    headers: {}, statusCode: null, body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function harness(options = {}) {
  const calls = { claim: [], prepare: [], sent: [], ignore: [], retry: [], review: [], get: [], list: [], send: [], fetch: [], logs: [], waits: [] };
  let state = options.initialState ?? 'pending';
  const statefulStore = {
    async claim(...args) {
      calls.claim.push(args);
      if (['sent', 'ignored', 'review_required', 'processing'].includes(state)) return { status: state };
      state = 'processing';
      return { status: 'claimed' };
    },
    async prepare(...args) { calls.prepare.push(args); return { status: 'ready' }; },
    async sent(...args) { calls.sent.push(args); state = 'sent'; return { status: 'sent' }; },
    async ignore(...args) { calls.ignore.push(args); state = 'ignored'; return { status: 'ignored' }; },
    async retry(...args) { calls.retry.push(args); state = 'pending'; return { status: 'retry' }; },
    async review(...args) { calls.review.push(args); state = 'review_required'; return { status: 'review_required' }; },
  };
  const store = { ...statefulStore, ...options.store };
  const provider = {
    webhooks: { verify: verifier.webhooks.verify.bind(verifier.webhooks) },
    emails: {
      receiving: {
        async get(...args) { calls.get.push(args); return options.get ? options.get(...args) : { data: options.mail ?? original(), error: null }; },
        attachments: {
          async list(...args) { calls.list.push(args); return options.list ? options.list(...args) : { data: { data: [], has_more: false }, error: null }; },
        },
      },
      async send(...args) { calls.send.push(args); return options.send ? options.send(...args) : { data: { id: SENT_ID }, error: null }; },
    },
  };
  const handler = createAdminEmailHandler({
    env: { ...env, ...options.env },
    createResend: options.createResend ?? (() => provider),
    createStore: () => store,
    fetchImpl: async (...args) => {
      calls.fetch.push(args);
      if (!options.fetchImpl) throw new Error('Unexpected attachment download');
      return options.fetchImpl(...args);
    },
    logger: { error: (...args) => calls.logs.push(args) },
    wait: async (...args) => { calls.waits.push(args); if (options.wait) await options.wait(...args); },
  });
  return {
    calls, store,
    async run(value = event(), requestOptions = {}) {
      const res = response();
      await handler(signedRequest(value, requestOptions), res);
      return res;
    },
  };
}

function assertNoProcessing(fixture) {
  assert.equal(fixture.calls.claim.length, 0);
  assert.equal(fixture.calls.get.length, 0);
  assert.equal(fixture.calls.send.length, 0);
}

function attachment(id = ATTACHMENT_A, overrides = {}) {
  return {
    id, filename: 'sample.txt', size: 3, content_type: 'text/plain',
    download_url: `https://inbound-cdn.resend.com/${EMAIL_ID}/attachments/${id}?signature=private-signed-url`,
    ...overrides,
  };
}

test('real Resend signature accepts exact raw bytes streamed across chunk boundaries', async () => {
  const raw = JSON.stringify(event(), null, 2);
  const fixture = harness();
  const res = await fixture.run(undefined, { raw, chunks: [Buffer.from(raw.slice(0, 37)), Buffer.from(raw.slice(37))] });
  assert.equal(res.statusCode, 200);
  assert.equal(fixture.calls.send.length, 1);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(fixture.calls.get[0][0], EMAIL_ID);
  assert.deepEqual(fixture.calls.get[0][1], { html_format: 'cid' });
});

test('tampered, missing, stale and future signatures cannot retrieve or send email', async t => {
  const scenarios = {
    tampered: { chunks: [Buffer.from(JSON.stringify(event()).replace('author@example.org', 'attacker@example.org'))] },
    'missing signature': { headers: { 'svix-signature': undefined } },
    'missing timestamp': { headers: { 'svix-timestamp': undefined } },
    'missing event id': { headers: { 'svix-id': undefined } },
    stale: { timestamp: Math.floor(Date.now() / 1000) - 600 },
    future: { timestamp: Math.floor(Date.now() / 1000) + 600 },
  };
  for (const [name, requestOptions] of Object.entries(scenarios)) await t.test(name, async () => {
    const fixture = harness();
    assert.equal((await fixture.run(event(), requestOptions)).statusCode, 400);
    assertNoProcessing(fixture);
  });
});

test('non-POST is rejected and unrelated events/recipients are acknowledged without processing', async () => {
  const fixture = harness();
  const method = await fixture.run(event(), { method: 'GET' });
  assert.equal(method.statusCode, 405);
  assert.equal(method.headers.Allow, 'POST');
  assert.equal((await fixture.run({ ...event(), type: 'email.sent' })).statusCode, 200);
  for (const recipient of ['support@reelbot.movie', 'admin@reelbot.movie.attacker.org', 'admin+extra@reelbot.movie']) {
    assert.equal((await fixture.run(event({ to: [recipient] }))).statusCode, 200);
  }
  assert.equal((await fixture.run(event({ to: ['other@example.org'], received_for: [ADMIN] }))).statusCode, 200);
  assertNoProcessing(fixture);
});

test('invalid received email identifiers are rejected before touching provider or store', async () => {
  const fixture = harness();
  assert.equal((await fixture.run(event({ email_id: '../../emails/private' }))).statusCode, 400);
  assertNoProcessing(fixture);
});

test('admin in To, Cc or Bcc qualifies but all outgoing delivery goes only to configured Gmail', async t => {
  for (const field of ['to', 'cc', 'bcc']) await t.test(field, async () => {
    const recipients = { to: ['other@example.org'], cc: ['cc@example.org'], bcc: ['private@example.org'], [field]: ['ReelBot Admin <ADMIN@REELBOT.MOVIE>'] };
    const fixture = harness({ mail: original(recipients) });
    assert.equal((await fixture.run(event({ ...recipients, forward_to: 'attacker@example.org' }))).statusCode, 200);
    const payload = fixture.calls.send[0][0];
    assert.deepEqual(payload.to, [DESTINATION]);
    assert.equal(payload.from, 'ReelBot Admin <admin@reelbot.movie>');
    assert.equal(payload.cc, undefined);
    assert.equal(payload.bcc, undefined);
    assert.doesNotMatch(payload.text, /private@example\.org/);
  });
});

test('retrieved recipient or email ID mismatch enters review and never forwards', async t => {
  for (const mail of [original({ to: ['other@example.org'] }), original({ id: SENT_ID })]) await t.test(mail.id + mail.to[0], async () => {
    const fixture = harness({ mail });
    assert.equal((await fixture.run()).statusCode, 503);
    assert.equal(fixture.calls.send.length, 0);
    assert.equal(fixture.calls.review[0][2], 'recipient_mismatch');
  });
});

test('forwarded attribution preserves the sender name/address with escaped metadata', async () => {
  const fixture = harness({ mail: original({ headers: { From: 'Author & Partner <author@example.org>' }, subject: '<Important> & private' }) });
  await fixture.run();
  const payload = fixture.calls.send[0][0];
  assert.match(payload.text, /Original From: Author & Partner <author@example\.org>/);
  assert.match(payload.html, /Original From: Author &amp; Partner &lt;author@example\.org&gt;/);
  assert.match(payload.html, /Subject: &lt;Important&gt; &amp; private/);
  assert.match(payload.text, /Private email contents/);
  assert.equal(payload.replyTo, 'author@example.org');
  assert.equal(payload.headers['X-ReelBot-Forwarded'], 'reelbot-admin-forward-v1');
  assert.equal(payload.headers['Auto-Submitted'], 'auto-generated');
  assert.equal(payload.headers['X-Auto-Response-Suppress'], 'All');
});

test('a conflicting From header cannot replace the retrieved original sender attribution', async () => {
  const fixture = harness({ mail: original({ headers: { from: 'Impostor <different@example.net>' } }) });
  await fixture.run();
  assert.match(fixture.calls.send[0][0].text, /Original From: author@example\.org/);
  assert.doesNotMatch(fixture.calls.send[0][0].text, /Impostor/);
});

test('Reply-To uses a safe single same-domain address and otherwise falls back or omits', async t => {
  const scenarios = [
    ['same domain', { reply_to: ['Support <support@example.org>'] }, 'support@example.org'],
    ['different domain', { reply_to: ['attacker@example.net'] }, 'author@example.org'],
    ['ambiguous addresses', { reply_to: ['one@example.org', 'two@example.org'] }, 'author@example.org'],
    ['header injection', { reply_to: ['author@example.org\r\nBcc: attacker@example.net'] }, 'author@example.org'],
    ['own domain', { reply_to: [ADMIN] }, 'author@example.org'],
    ['failed sender authentication', { authentication: { dmarc: 'fail' } }, undefined],
    ['malformed original sender', { from: 'not an address' }, undefined],
  ];
  for (const [name, overrides, expected] of scenarios) await t.test(name, async () => {
    const fixture = harness({ mail: original(overrides) });
    assert.equal((await fixture.run()).statusCode, 200);
    assert.equal(fixture.calls.send[0][0].replyTo, expected);
  });
});

test('loop and automatic-message headers stop forwarding before attachment work', async t => {
  const scenarios = [
    ['marker', { headers: { 'X-ReelBot-Forwarded': 'reelbot-admin-forward-v1' } }, 'forwarding_loop'],
    ['loop header', { headers: { 'X-Loop': 'reelbot-admin-forward-v1' } }, 'forwarding_loop'],
    ['auto reply', { headers: { 'Auto-Submitted': 'auto-replied' } }, 'automatic_reply'],
    ['auto reply parameters', { headers: { 'Auto-Submitted': 'auto-replied; owner-email=bot@example.org' } }, 'automatic_reply'],
    ['delivery report', { headers: { 'Return-Path': '<>' } }, 'delivery_report'],
    ['own sender', { from: ADMIN }, 'own_sender'],
  ];
  for (const [name, overrides, reason] of scenarios) await t.test(name, async () => {
    const fixture = harness({ mail: original(overrides) });
    assert.equal((await fixture.run()).statusCode, 200);
    assert.equal(fixture.calls.send.length, 0);
    assert.equal(fixture.calls.list.length, 0);
    assert.equal(fixture.calls.ignore[0][2], reason);
  });
});

test('a normal message originating from destination Gmail and Auto-Submitted:no still forwards', async () => {
  const fixture = harness({ mail: original({ from: DESTINATION, headers: { 'Auto-Submitted': 'no' } }) });
  assert.equal((await fixture.run()).statusCode, 200);
  assert.equal(fixture.calls.send.length, 1);
});

test('automatic receipts and other ReelBot sender addresses remain eligible inbox mail', async t => {
  for (const from of ['receipt@example.org', 'alerts@reelbot.movie', 'feedback@reelbot.movie']) await t.test(from, async () => {
    const fixture = harness({ mail: original({ from, headers: { 'Auto-Submitted': 'auto-generated' } }) });
    assert.equal((await fixture.run()).statusCode, 200);
    assert.equal(fixture.calls.send.length, 1);
  });
});

test('all attachment pages are fetched, CID survives, bytes are stable and no credentials go to CDN', async () => {
  const first = attachment(ATTACHMENT_B, { filename: '../inline.png', content_type: 'image/png', content_id: '<image-1>' });
  const second = attachment(ATTACHMENT_A, { filename: 'document.txt' });
  const fixture = harness({
    mail: original({ html: '<img src="cid:image-1">', attachments: [{ id: ATTACHMENT_A }, { id: ATTACHMENT_B }] }),
    list: async options => ({ data: options.after ? { data: [second], has_more: false } : { data: [first], has_more: true }, error: null }),
    fetchImpl: async () => new Response(Buffer.from('abc')),
  });
  assert.equal((await fixture.run()).statusCode, 200);
  assert.equal(fixture.calls.list.length, 2);
  assert.equal(fixture.calls.list[1][0].after, ATTACHMENT_B);
  assert.equal(fixture.calls.list[0][0].limit, 100);
  const payload = fixture.calls.send[0][0];
  assert.deepEqual(payload.attachments.map(item => item.filename), ['document.txt', '.._inline.png']);
  assert.equal(payload.attachments[1].contentId, 'image-1');
  assert.equal(payload.attachments[1].contentType, 'image/png');
  assert.equal(payload.attachments[0].content, 'YWJj');
  assert.match(payload.html, /cid:image-1/);
  assert.equal(payload.attachments[0].path, undefined);
  for (const [, options] of fixture.calls.fetch) {
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers, undefined);
  }
});

test('attachment URLs cannot send network requests to untrusted hosts, protocols or credentials', async t => {
  const urls = [
    'http://inbound-cdn.resend.com/file',
    'https://inbound-cdn.resend.com.attacker.org/file',
    'https://127.0.0.1/private',
    'https://169.254.169.254/latest/meta-data',
    'https://inbound-cdn.resend.com:8443/file',
    'https://username:password@inbound-cdn.resend.com/file',
    'file:///private/email',
    'not a url',
  ];
  for (const download_url of urls) await t.test(download_url, async () => {
    const fixture = harness({ list: async () => ({ data: { data: [attachment(ATTACHMENT_A, { download_url })], has_more: false } }) });
    assert.equal((await fixture.run()).statusCode, 503);
    assert.equal(fixture.calls.fetch.length, 0);
    assert.equal(fixture.calls.send.length, 0);
    assert.equal(fixture.calls.review[0][2], 'attachment_url_invalid');
  });
});

test('attachment download errors, truncation and missing metadata never produce partial forwards', async t => {
  const scenarios = [
    ['HTTP error', () => new Response('', { status: 503 }), 'attachment_download_unavailable'],
    ['truncated body', () => new Response(Buffer.from('ab')), 'attachment_download_incomplete'],
    ['network error', () => { throw new Error('private signed download URL failed'); }, 'processing_unavailable'],
  ];
  for (const [name, fetchImpl, code] of scenarios) await t.test(name, async () => {
    const fixture = harness({
      mail: original({ attachments: [{ id: ATTACHMENT_A }] }),
      list: async () => ({ data: { data: [attachment()], has_more: false } }), fetchImpl,
    });
    assert.equal((await fixture.run()).statusCode, 503);
    assert.equal(fixture.calls.send.length, 0);
    assert.equal(fixture.calls.retry[0][2], code);
  });
  const fixture = harness({ mail: original({ attachments: [{ id: ATTACHMENT_A }] }) });
  assert.equal((await fixture.run()).statusCode, 503);
  assert.equal(fixture.calls.retry[0][2], 'attachments_incomplete');
  assert.equal(fixture.calls.send.length, 0);
});

test('empty continuing pages and repeated attachment IDs fail without downloading or sending', async t => {
  for (const data of [{ data: [], has_more: true }, { data: [attachment(), attachment()], has_more: false }]) await t.test(JSON.stringify(data).slice(0, 35), async () => {
    const fixture = harness({ list: async () => ({ data }) });
    assert.equal((await fixture.run()).statusCode, 503);
    assert.equal(fixture.calls.fetch.length, 0);
    assert.equal(fixture.calls.send.length, 0);
    assert.equal(fixture.calls.retry[0][2], 'attachments_unavailable');
  });
});

test('oversized attachments enter review before download, and lying size is bounded while streaming', async () => {
  const oversized = harness({ list: async () => ({ data: { data: [attachment(ATTACHMENT_A, { size: 30 * 1024 * 1024 })], has_more: false } }) });
  assert.equal((await oversized.run()).statusCode, 503);
  assert.equal(oversized.calls.fetch.length, 0);
  assert.equal(oversized.calls.review[0][2], 'message_too_large');
  const lying = harness({
    list: async () => ({ data: { data: [attachment()], has_more: false } }),
    fetchImpl: async () => new Response(Buffer.from('more than three bytes')),
  });
  assert.equal((await lying.run()).statusCode, 503);
  assert.equal(lying.calls.review[0][2], 'message_too_large');
  assert.equal(lying.calls.send.length, 0);
});

test('transient provider failures retry with content-free logs and responses', async t => {
  const privateMessage = 'PRIVATE body author@example.org re_secret https://private-url?signature=secret';
  const error = { name: 'rate_limit_exceeded', message: privateMessage };
  const scenarios = [
    ['receive', { get: async () => ({ error }) }, 'receive_unavailable'],
    ['attachments', { list: async () => ({ error }) }, 'attachments_unavailable'],
    ['send', { send: async () => ({ error }) }, 'send_unavailable'],
    ['thrown exception', { get: async () => { throw new Error(privateMessage); } }, 'processing_unavailable'],
  ];
  for (const [name, options, code] of scenarios) await t.test(name, async () => {
    const fixture = harness(options);
    const res = await fixture.run();
    assert.equal(res.statusCode, 503);
    assert.equal(fixture.calls.retry[0][2], code);
    const output = JSON.stringify({ logs: fixture.calls.logs, response: res.body });
    for (const privateValue of ['PRIVATE', 'author@example.org', 're_secret', 'signature=secret', EMAIL_ID, 'Private email contents']) assert.equal(output.includes(privateValue), false);
    assert.match(fixture.calls.logs[0][1].reference, /^[a-f0-9]{16}$/);
  });
});

test('permanent send rejection requires review; subsequent replay cannot resend', async t => {
  for (const name of ['validation_error', 'invalid_idempotent_request', 'invalid_attachment', 'invalid_parameter', 'missing_required_field', 'missing_required_parameter', 'invalid_from_address']) await t.test(name, async () => {
    const fixture = harness({ send: async () => ({ error: { name, message: 'PRIVATE unsupported attachment' } }) });
    assert.equal((await fixture.run()).statusCode, 503);
    assert.equal(fixture.calls.review[0][2], 'send_rejected');
    assert.equal((await fixture.run()).statusCode, 503);
    assert.equal(fixture.calls.send.length, 1);
    assert.equal(fixture.calls.waits.length, 0);
  });
});

test('completed delivery and later replay produce only one outgoing send', async () => {
  const fixture = harness();
  assert.equal((await fixture.run()).statusCode, 200);
  assert.equal((await fixture.run(event(), { id: 'different_delivery_or_manual_replay' })).statusCode, 200);
  assert.equal(fixture.calls.send.length, 1);
  assert.equal(fixture.calls.claim.length, 2);
  assert.equal(fixture.calls.sent[0][2], SENT_ID);
});

test('concurrent deliveries cannot both proceed past the durable claim', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let firstReachedProvider;
  const reached = new Promise(resolve => { firstReachedProvider = resolve; });
  const fixture = harness({ get: async () => { firstReachedProvider(); await gate; return { data: original() }; } });
  const first = fixture.run();
  await reached;
  const concurrent = await fixture.run(event(), { id: 'concurrent_delivery' });
  assert.equal(concurrent.statusCode, 503);
  assert.equal(fixture.calls.get.length, 1);
  release();
  assert.equal((await first).statusCode, 200);
  assert.equal(fixture.calls.send.length, 1);
});

test('send success followed by database failure reuses identical payload/key on retry', async () => {
  let saves = 0;
  const accepted = new Map();
  let deliveries = 0;
  const fixture = harness({ send: async (payload, options) => {
    const serialized = JSON.stringify(payload);
    if (accepted.has(options.idempotencyKey)) assert.equal(accepted.get(options.idempotencyKey), serialized);
    else { accepted.set(options.idempotencyKey, serialized); deliveries++; }
    return { data: { id: SENT_ID } };
  } });
  const originalSent = fixture.store.sent;
  fixture.store.sent = async (...args) => {
    if (saves++ === 0) throw new Error('Database connection lost after provider accepted message');
    return originalSent(...args);
  };
  assert.equal((await fixture.run()).statusCode, 503);
  assert.equal((await fixture.run()).statusCode, 200);
  assert.equal(deliveries, 1);
  assert.equal(fixture.calls.send.length, 2);
  assert.equal(fixture.calls.send[0][1].idempotencyKey, `reelbot-admin-forward-v1/${EMAIL_ID}`);
  assert.equal(fixture.calls.prepare[0][2], fixture.calls.prepare[1][2]);
  assert.equal((await fixture.run()).statusCode, 200);
  assert.equal(fixture.calls.send.length, 2);
});

test('uncertain send result retries, but ledger review or not-ready prevents another send', async t => {
  const uncertain = harness({ send: async () => ({ data: { id: 'not-a-provider-id' } }) });
  assert.equal((await uncertain.run()).statusCode, 503);
  assert.equal(uncertain.calls.retry[0][2], 'send_outcome_unknown');
  for (const status of ['review_required', 'busy']) await t.test(status, async () => {
    const fixture = harness({ store: { prepare: async () => ({ status }) } });
    assert.equal((await fixture.run()).statusCode, 503);
    assert.equal(fixture.calls.send.length, 0);
  });
});

test('disabled, preview and missing/invalid settings fail closed before processing', async t => {
  const scenarios = [
    ['disabled', { ADMIN_EMAIL_FORWARDING_ENABLED: 'false' }],
    ['unset enabled', { ADMIN_EMAIL_FORWARDING_ENABLED: undefined }],
    ['preview', { VERCEL_ENV: 'preview' }],
    ['development', { VERCEL_ENV: 'development' }],
    ['missing key', { RESEND_INBOUND_API_KEY: '' }],
    ['missing secret', { RESEND_WEBHOOK_SECRET: '' }],
    ['missing destination', { ADMIN_EMAIL_TO: '' }],
    ['non-Gmail destination', { ADMIN_EMAIL_TO: 'attacker@example.org' }],
    ['multiple destinations', { ADMIN_EMAIL_TO: 'one@gmail.com,two@gmail.com' }],
    ['destination injection', { ADMIN_EMAIL_TO: 'one@gmail.com\r\nBcc: attacker@example.org' }],
  ];
  for (const [name, overrides] of scenarios) await t.test(name, async () => {
    const fixture = harness({ env: overrides });
    assert.equal((await fixture.run()).statusCode, 503);
    assertNoProcessing(fixture);
  });
});

test('payload byte limits apply to both advertised length and actual streamed bytes', async () => {
  const advertised = harness();
  assert.equal((await advertised.run(event(), { headers: { 'content-length': String(MAX_WEBHOOK_BYTES + 1) } })).statusCode, 413);
  assertNoProcessing(advertised);
  const chunked = harness();
  assert.equal((await chunked.run(event(), { chunks: [Buffer.alloc(MAX_WEBHOOK_BYTES, 'a'), Buffer.from('b')], headers: { 'content-length': '1' } })).statusCode, 413);
  assertNoProcessing(chunked);
  const unicode = harness();
  const large = { ...event(), filler: '€'.repeat(Math.ceil(MAX_WEBHOOK_BYTES / 3)) };
  assert.equal((await unicode.run(large)).statusCode, 413);
  assertNoProcessing(unicode);
});

test('mailbox rejects malformed addresses, lists, header injection and unmatched delimiters', () => {
  for (const value of ['one@example.org,two@example.org', 'one@example.org\nBcc:two@example.org', 'Name <one@example.org', 'one@example.org>', '.one@example.org', 'one..two@example.org', 'one@example..org', 'other@example.org, Name <admin@reelbot.movie>', 'Group: Admin <admin@reelbot.movie>;', 'Last, First <author@example.org>']) assert.equal(mailbox(value), null, value);
  assert.equal(mailbox('Example Author <AUTHOR@example.org>'), 'author@example.org');
  assert.equal(mailbox('"Last, First" <author@example.org>'), 'author@example.org');
});

test('rate-limited get, attachment list and send retry in place with one shared deadline', async () => {
  const counts = { get: 0, list: 0, send: 0 };
  const limited = { data: null, error: { name: 'rate_limit_exceeded', statusCode: 429 }, headers: { 'retry-after': '1' } };
  const fixture = harness({
    get: async () => ++counts.get === 1 ? limited : { data: original() },
    list: async () => ++counts.list === 1 ? limited : { data: { data: [], has_more: false } },
    send: async () => ++counts.send === 1 ? limited : { data: { id: SENT_ID } },
  });
  assert.equal((await fixture.run()).statusCode, 200);
  assert.deepEqual(counts, { get: 2, list: 2, send: 2 });
  assert.deepEqual(fixture.calls.waits.map(([milliseconds]) => milliseconds), [1100, 1100, 1100]);
  assert.equal(fixture.calls.get.length, 2, 'send retry must not restart message retrieval');
  assert.equal(fixture.calls.prepare.length, 1);
  assert.equal(fixture.calls.send[0][0], fixture.calls.send[1][0], 'retry uses the same composed payload');
  assert.equal(fixture.calls.send[0][1].idempotencyKey, fixture.calls.send[1][1].idempotencyKey);
  const signal = fixture.calls.get[0][2].signal;
  for (const [, waitSignal] of fixture.calls.waits) assert.equal(waitSignal, signal);
  for (const [, options] of fixture.calls.list) assert.equal(options.signal, signal);
  for (const [, options] of fixture.calls.send) assert.equal(options.signal, signal);
});

test('rate-limit retry honors response delays and never truncates a longer provider delay', async t => {
  const scenarios = [
    ['retry-after has priority', { 'retry-after': '2', 'ratelimit-reset': '1' }, [2100, 2100]],
    ['reset fallback', { 'ratelimit-reset': '0.5' }, [600, 600]],
    ['invalid retry-after uses reset', { 'retry-after': 'invalid', 'ratelimit-reset': '2' }, [2100, 2100]],
    ['missing delay uses backoff', {}, [1100, 2100]],
    ['invalid delays use backoff', { 'retry-after': '-1', 'ratelimit-reset': 'Infinity' }, [1100, 2100]],
    ['bounded five second wait', { 'retry-after': '5' }, [5000, 5000]],
    ['long delay deferred to webhook', { 'retry-after': '30' }, []],
  ];
  for (const [name, headers, waits] of scenarios) await t.test(name, async () => {
    const fixture = harness({ send: async () => ({ error: { name: 'rate_limit_exceeded', statusCode: 429 }, headers }) });
    assert.equal((await fixture.run()).statusCode, 503);
    assert.deepEqual(fixture.calls.waits.map(([milliseconds]) => milliseconds), waits);
    assert.equal(fixture.calls.send.length, waits.length + 1);
    assert.equal(fixture.calls.retry[0][2], 'send_unavailable');
  });
});

test('concurrent idempotent request can retry, while quotas and generic failures do not retry inline', async t => {
  let attempts = 0;
  const concurrent = harness({ send: async () => ++attempts === 1 ? { error: { name: 'concurrent_idempotent_requests', statusCode: 409 } } : { data: { id: SENT_ID } } });
  assert.equal((await concurrent.run()).statusCode, 200);
  assert.equal(concurrent.calls.send.length, 2);
  assert.equal(concurrent.calls.waits.length, 1);
  for (const name of ['daily_quota_exceeded', 'monthly_quota_exceeded', 'application_error', 'service_unavailable']) await t.test(name, async () => {
    const fixture = harness({ send: async () => ({ error: { name, statusCode: 429 }, headers: { 'retry-after': '1' } }) });
    assert.equal((await fixture.run()).statusCode, 503);
    assert.equal(fixture.calls.send.length, 1);
    assert.equal(fixture.calls.waits.length, 0);
  });
});

test('aborted shared signal stops before retry and interrupts the real retry timer', async () => {
  const aborted = new AbortController();
  aborted.abort(new Error('test operation expired'));
  let attempts = 0;
  await assert.rejects(providerCall(async () => { attempts++; }, { signal: aborted.signal }), /test operation expired/);
  assert.equal(attempts, 0);
  const controller = new AbortController();
  const pending = providerCall(async () => {
    attempts++;
    return { error: { name: 'rate_limit_exceeded' }, headers: { 'retry-after': '5' } };
  }, { signal: controller.signal });
  await Promise.resolve();
  controller.abort(new Error('cancelled during backoff'));
  await assert.rejects(pending, error => error.name === 'AbortError' || /cancelled during backoff/.test(error.message));
  assert.equal(attempts, 1);
});

test('SDK-style swallowed abort is not retried or mistaken for a successful response', async () => {
  const controller = new AbortController();
  let waits = 0;
  await assert.rejects(providerCall(async () => {
    controller.abort(new Error('provider deadline expired'));
    return { data: null, error: { name: 'application_error', statusCode: null }, headers: null };
  }, { signal: controller.signal, wait: async () => { waits++; } }), /provider deadline expired/);
  assert.equal(waits, 0);
});

test('real SDK mocked HTTP failure cannot leak provider content or received email ID to console', async t => {
  const consoleCalls = [];
  t.mock.method(console, 'error', (...args) => consoleCalls.push(args));
  const transport = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    name: 'application_error', statusCode: 500,
    message: `PRIVATE author@example.org body secret https://signed.example?signature=private ${EMAIL_ID}`,
  }), { status: 500, headers: { 'Content-Type': 'application/json' } }));
  const sdk = new Resend('re_unit_test_no_external_calls', { baseUrl: 'https://api.resend.com' });
  let sdkLogCalls = 0;
  const originalSdkLogger = sdk.logError.bind(sdk);
  sdk.logError = (...args) => { sdkLogCalls++; originalSdkLogger(...args); };
  const fixture = harness({ createResend: () => sdk });
  const res = await fixture.run();
  assert.equal(res.statusCode, 503);
  assert.equal(transport.mock.callCount(), 1);
  assert.equal(sdkLogCalls, 0, 'the instance logger is suppressed independent of NODE_ENV');
  assert.deepEqual(consoleCalls, []);
  assert.equal(fixture.calls.logs[0][1].code, 'receive_unavailable');
  assert.doesNotMatch(JSON.stringify(fixture.calls.logs), /PRIVATE|author@example\.org|signature=private/);
  assert.equal(JSON.stringify(fixture.calls.logs).includes(EMAIL_ID), false);
});
