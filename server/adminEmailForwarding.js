const { createHash, randomUUID } = require('node:crypto');
const { setTimeout: waitTimer } = require('node:timers/promises');

const ADMIN = 'admin@reelbot.movie';
const MARKER = 'reelbot-admin-forward-v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_WEBHOOK_BYTES = 256 * 1024;
// Leave room for MIME encoding and headers below Resend's 40 MB send limit.
const MAX_MESSAGE_BYTES = 30 * 1024 * 1024;
const MAX_ATTACHMENTS = 100;
const clean = value => String(value || '').replace(/[\x00-\x1f\x7f]/g, ' ').trim();
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash = value => createHash('sha256').update(value).digest('hex');

class ForwardError extends Error {
  constructor(code, review = false) { super(code); this.code = code; this.review = review; }
}

// Intentionally accept one conventional mailbox only; ambiguous lists, groups,
// quoted local parts, and control characters never become routing instructions.
function mailbox(value) {
  if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value) || value.length > 512) return null;
  let bare = value.trim();
  if (/[<>]/.test(bare)) {
    const named = bare.match(/^(?:"(?:[^"\\]|\\.)*"|[^<>,;:"\\]*)\s*<([^<>\s]+)>$/);
    if (!named) return null;
    bare = named[1];
  }
  const match = bare.match(/^([A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,})$/);
  if (!match) return null;
  const address = match[1].toLowerCase();
  const [local, domain] = address.split('@');
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..') || domain.includes('..') || address.length > 254) return null;
  return address;
}

function addresses(value) { return Array.isArray(value) ? value : []; }
function forAdmin(mail) { return ['to','cc','bcc'].some(key => addresses(mail?.[key]).some(v => mailbox(v) === ADMIN)); }
function ownDomain(address) { return address?.split('@')[1] === 'reelbot.movie'; }
function headersOf(mail) {
  return Object.fromEntries(Object.entries(mail.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
}
function loopReason(mail) {
  const headers = headersOf(mail);
  if (headers['x-reelbot-forwarded'] || String(headers['x-loop'] || '').includes(MARKER)) return 'forwarding_loop';
  if (mailbox(mail.from) === ADMIN) return 'own_sender';
  // Receipts/security notices marked auto-generated are legitimate inbox mail.
  if (/^auto-replied(?:\s*;|$)/i.test(clean(headers['auto-submitted']))) return 'automatic_reply';
  if (clean(headers['return-path']) === '<>') return 'delivery_report';
  return null;
}

function safeReplyTo(mail) {
  const from = mailbox(mail.from);
  if (!from || ownDomain(from) || mail.authentication?.dmarc === 'fail') return null;
  const candidates = addresses(mail.reply_to);
  const reply = candidates.length === 1 ? mailbox(candidates[0]) : null;
  // A third-party Reply-To must not quietly redirect the administrator's reply.
  return reply && !ownDomain(reply) && reply.split('@')[1] === from.split('@')[1] ? reply : from;
}

function compose(mail, destination, attachments) {
  const headerFrom = headersOf(mail).from;
  const originalFrom = mailbox(headerFrom) === mailbox(mail.from) && mailbox(mail.from) ? headerFrom : mail.from;
  const replyTo = safeReplyTo(mail);
  const metadata = [
    'Forwarded to the ReelBot administrator',
    `Original From: ${clean(originalFrom)}`,
    `Original To: ${addresses(mail.to).map(clean).join(', ')}`,
    ...(addresses(mail.cc).length ? [`Original Cc: ${mail.cc.map(clean).join(', ')}`] : []),
    `Received: ${clean(mail.created_at)}`,
    `Subject: ${clean(mail.subject) || '(no subject)'}`,
    `Reply-To: ${replyTo || 'not set (original sender could not be safely used)'}`,
    'Sender information is supplied by the original message; forwarding does not verify its identity.',
  ].join('\n');
  const payload = {
    from: 'ReelBot Admin <admin@reelbot.movie>',
    to: [destination],
    subject: `Fwd: ${clean(mail.subject) || '(no subject)'}`.slice(0, 998),
    text: `${metadata}\n\n---------- Original message ----------\n\n${mail.text || '(See the HTML version of this message.)'}`,
    ...(mail.html ? {html: `<pre>${escapeHtml(metadata)}</pre><hr><blockquote>${mail.html}</blockquote>`} : {}),
    ...(replyTo ? {replyTo} : {}),
    headers: {'X-ReelBot-Forwarded': MARKER, 'X-Loop': MARKER, 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All'},
    ...(attachments.length ? {attachments} : {}),
  };
  if (Buffer.byteLength(JSON.stringify(payload)) > MAX_MESSAGE_BYTES) throw new ForwardError('message_too_large', true);
  return payload;
}

async function readBounded(stream, maxBytes) {
  const chunks = []; let size = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk); size += bytes.length;
    if (size > maxBytes) throw new ForwardError('message_too_large', true);
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function providerData(result, stage) {
  if (result?.error || !result?.data) {
    const name = result?.error?.name;
    const permanent = stage === 'send' && ['validation_error','invalid_idempotent_request','invalid_attachment','invalid_parameter','missing_required_field','missing_required_parameter','invalid_from_address'].includes(name);
    throw new ForwardError(permanent ? 'send_rejected' : `${stage}_unavailable`, permanent);
  }
  return result.data;
}

const waitForRetry = (milliseconds, signal) => waitTimer(milliseconds, undefined, {signal});

async function providerCall(operation, {signal, wait = waitForRetry} = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted();
    const result = await operation();
    // The SDK converts aborted fetches to error responses instead of throwing.
    signal?.throwIfAborted();
    if (attempt === 2 || !['rate_limit_exceeded','concurrent_idempotent_requests'].includes(result?.error?.name)) return result;
    const seconds = ['retry-after','ratelimit-reset']
      .map(name => result.headers?.[name])
      .filter(value => typeof value === 'number' || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())))
      .map(Number)
      .find(value => Number.isFinite(value) && value >= 0) ?? 2 ** attempt;
    // Longer delays return to the webhook retry schedule; never retry early.
    if (seconds > 5) return result;
    await wait(Math.min(5000, Math.ceil(seconds * 1000) + 100), signal);
  }
}

async function attachmentsFor(resend, emailId, fetchImpl, signal, wait = waitForRetry) {
  const records = []; const seen = new Set(); let after;
  do {
    const page = providerData(await providerCall(() => resend.emails.receiving.attachments.list({emailId, limit:100, ...(after ? {after} : {})}, {signal}), {signal,wait}), 'attachments');
    if (!Array.isArray(page.data) || (page.has_more && !page.data.length)) throw new ForwardError('attachments_unavailable');
    for (const item of page.data) {
      if (!UUID.test(item.id || '') || seen.has(item.id)) throw new ForwardError('attachments_unavailable');
      seen.add(item.id); records.push(item);
      if (records.length > MAX_ATTACHMENTS) throw new ForwardError('too_many_attachments', true);
    }
    after = page.has_more ? page.data.at(-1).id : undefined;
  } while (after);
  records.sort((a,b) => a.id.localeCompare(b.id));
  const attachments = []; let encodedBytes = 0;
  for (const item of records) {
    if (!Number.isSafeInteger(item.size) || item.size < 0) throw new ForwardError('attachments_unavailable');
    if (encodedBytes + 4 * Math.ceil(item.size / 3) > MAX_MESSAGE_BYTES) throw new ForwardError('message_too_large', true);
    let url;
    try { url = new URL(item.download_url); } catch { throw new ForwardError('attachment_url_invalid', true); }
    // Only download provider-issued URLs; never follow a redirect or send our API key to the CDN.
    if (url.protocol !== 'https:' || url.hostname !== 'inbound-cdn.resend.com' || url.port || url.username || url.password) throw new ForwardError('attachment_url_invalid', true);
    const response = await fetchImpl(url.href, {signal, redirect:'error'});
    if (!response.ok || !response.body) throw new ForwardError('attachment_download_unavailable');
    const bytes = await readBounded(response.body, Math.min(item.size, Math.floor((MAX_MESSAGE_BYTES - encodedBytes) * 3 / 4)));
    if (bytes.length !== item.size) throw new ForwardError('attachment_download_incomplete');
    const content = bytes.toString('base64'); encodedBytes += content.length;
    const filename = clean(item.filename || `attachment-${item.id}`).replace(/[\\/]/g, '_').slice(0,255);
    attachments.push({filename, content, contentType: clean(item.content_type) || 'application/octet-stream', ...(item.content_id ? {contentId:clean(item.content_id).replace(/^<|>$/g, '')} : {})});
  }
  return attachments;
}

function defaultStore(env) {
  const { createClient } = require('@supabase/supabase-js');
  const { createAdminEmailStore } = require('./adminEmailStore');
  const url = String(env.SUPABASE_URL || env.REACT_APP_SUPABASE_URL || '').trim().replace(/\/(?:rest\/v1)?\/?$/, '');
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ForwardError('configuration_missing');
  return createAdminEmailStore(createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options) => fetch(url,{...options,signal:AbortSignal.timeout(5000)})}}));
}

function createAdminEmailHandler({env = process.env, createResend, createStore = defaultStore, fetchImpl = fetch, logger = console, wait = waitForRetry} = {}) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store');
    const respond = (status, value) => res.status(status).json(value);
    if (req.method !== 'POST') { res.setHeader('Allow','POST'); return respond(405,{error:'Method not allowed'}); }
    let emailId, store, token, claimed = false;
    const log = code => logger.error('admin_email_forwarding', {code, ...(emailId ? {reference:hash(emailId).slice(0,16)} : {})});
    try {
      // Preview deployments must never forward production mail.
      if (env.ADMIN_EMAIL_FORWARDING_ENABLED !== 'true' || (env.VERCEL_ENV && env.VERCEL_ENV !== 'production')) return respond(503,{error:'Forwarding disabled'});
      const destination = mailbox(env.ADMIN_EMAIL_TO);
      if (!env.RESEND_INBOUND_API_KEY || !env.RESEND_WEBHOOK_SECRET || !destination || !/@(?:gmail|googlemail)\.com$/.test(destination)) throw new ForwardError('configuration_missing');
      const resend = createResend ? createResend(env.RESEND_INBOUND_API_KEY) : new (require('resend').Resend)(env.RESEND_INBOUND_API_KEY, {baseUrl:'https://api.resend.com'});
      // Pinned SDK 6.32.1 logs raw provider errors outside production. Suppress
      // its instance logger so only our content-free error categories are logged.
      resend.logError = () => {};
      const length = Number(req.headers['content-length']);
      if (length > MAX_WEBHOOK_BYTES) return respond(413,{error:'Payload too large'});
      let raw;
      try { raw = (await readBounded(req,MAX_WEBHOOK_BYTES)).toString('utf8'); }
      catch { return respond(413,{error:'Invalid payload'}); }
      let event;
      try {
        event = resend.webhooks.verify({payload:raw,webhookSecret:env.RESEND_WEBHOOK_SECRET,headers:{id:req.headers['svix-id'],timestamp:req.headers['svix-timestamp'],signature:req.headers['svix-signature']}});
      } catch { return respond(400,{error:'Invalid signature'}); }
      if (event?.type !== 'email.received') return respond(200,{ok:true});
      if (!UUID.test(event.data?.email_id || '')) return respond(400,{error:'Invalid event'});
      // A signed provider event cannot nominate an outgoing address or arbitrary mailbox to fetch.
      if (!forAdmin(event.data)) return respond(200,{ok:true});
      emailId = event.data.email_id.toLowerCase(); token = randomUUID(); store = createStore(env);
      const claim = await store.claim(emailId,token);
      if (['sent','ignored'].includes(claim.status)) return respond(200,{ok:true});
      if (claim.status !== 'claimed') throw new ForwardError(claim.status === 'review_required' ? 'review_required' : 'delivery_busy');
      claimed = true;
      const signal = AbortSignal.timeout(40000);
      const mail = providerData(await providerCall(() => resend.emails.receiving.get(emailId,{html_format:'cid'},{signal}), {signal,wait}), 'receive');
      if (mail.id !== emailId || !forAdmin(mail)) throw new ForwardError('recipient_mismatch', true);
      const loop = loopReason(mail);
      if (loop) {
        const result = await store.ignore(emailId,token,loop);
        if (result.status !== 'ignored') throw new ForwardError('ledger_unavailable');
        return respond(200,{ok:true});
      }
      const attachments = await attachmentsFor(resend,emailId,fetchImpl,signal,wait);
      if (Array.isArray(mail.attachments) && mail.attachments.length !== attachments.length) throw new ForwardError('attachments_incomplete');
      const payload = compose(mail,destination,attachments);
      const prepared = await store.prepare(emailId,token,hash(JSON.stringify(payload)));
      if (prepared.status !== 'ready') throw new ForwardError(prepared.status === 'review_required' ? 'review_required' : 'delivery_busy');
      const sent = providerData(await providerCall(() => resend.emails.send(payload,{idempotencyKey:`${MARKER}/${emailId}`,signal}), {signal,wait}), 'send');
      if (!UUID.test(sent.id || '')) throw new ForwardError('send_outcome_unknown');
      const saved = await store.sent(emailId,token,sent.id);
      if (saved.status !== 'sent') throw new ForwardError('ledger_unavailable');
      return respond(200,{ok:true});
    } catch (error) {
      const safe = error instanceof ForwardError ? error : new ForwardError('processing_unavailable');
      log(safe.code);
      if (claimed) {
        try { await (safe.review ? store.review(emailId,token,safe.code) : store.retry(emailId,token,safe.code)); }
        catch { log('ledger_unavailable'); }
      }
      // Non-2xx keeps failures visible and lets Resend retry/replay. Never acknowledge a failed send.
      return respond(503,{error:'Forwarding temporarily unavailable'});
    }
  };
}

module.exports = {createAdminEmailHandler, mailbox, safeReplyTo, compose, attachmentsFor, loopReason, providerCall, MAX_WEBHOOK_BYTES};
