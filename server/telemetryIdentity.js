const {createHmac, timingSafeEqual, randomUUID} = require('node:crypto');
const secret = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
function ownerDigest(id) { return id && secret() ? createHmac('sha256',secret()).update(`metrics-owner:${id}`).digest('hex') : ''; }
function ownerCookie(id, now=Date.now()) {
  const owner=ownerDigest(id); if(!owner)return null;
  const payload=`${owner}.${now+30*86400000}`;
  const signature=createHmac('sha256',secret()).update(payload).digest('hex');
  return `rb_metrics_owner=${payload}.${signature}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}
function readOwnerCookie(cookie='',now=Date.now()) {
  const token=String(cookie).split(';').map(x=>x.trim()).find(x=>x.startsWith('rb_metrics_owner='))?.slice(17) || '';
  const [owner,expires,signature]=token.split('.');
  if(!secret()||!/^[a-f0-9]{64}$/.test(owner||'')||!/^[a-f0-9]{64}$/.test(signature||'')||!/^\d+$/.test(expires||'')||Number(expires)<=now)return '';
  const expected=createHmac('sha256',secret()).update(`${owner}.${expires}`).digest('hex');
  return timingSafeEqual(Buffer.from(expected),Buffer.from(signature))?owner:'';
}
module.exports={ownerDigest,ownerCookie,readOwnerCookie};

// Signed continuity is evidence that this browser previously submitted this visit.
// A client-supplied session UUID alone must never claim another visitor's history.
function visitCookie(session, now=Date.now(), continuity=randomUUID()) {
 const expires=now+86400000;
 const payload=`${session}.${continuity}.${expires}`;
 const signature=createHmac('sha256',secret()).update(`metrics-visit:${payload}`).digest('hex');
 return `rb_metrics_visit=${payload}.${signature}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`;
}
function readVisitCookie(cookie='',now=Date.now()) {
 const token=String(cookie).split(';').map(x=>x.trim()).find(x=>x.startsWith('rb_metrics_visit='))?.slice(17)||'';
 const [session,continuity,expires,signature]=token.split('.');
 if(!secret()||!/^[0-9a-f-]{36}$/i.test(continuity||'')||!/^[0-9a-f-]{36}$/i.test(session||'')||!/^[a-f0-9]{64}$/.test(signature||'')||!/^\d+$/.test(expires||'')||Number(expires)<=now)return '';
 const expected=createHmac('sha256',secret()).update(`metrics-visit:${session}.${continuity}.${expires}`).digest('hex');
 return timingSafeEqual(Buffer.from(expected),Buffer.from(signature))?{session,continuity}:null;
}
module.exports.visitCookie=visitCookie;
module.exports.readVisitCookie=readVisitCookie;
