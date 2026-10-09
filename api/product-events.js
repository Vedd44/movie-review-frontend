const { createClient } = require('@supabase/supabase-js');
const { normalizeBatch, createTelemetryStore } = require('../server/productTelemetry');
const { ownerDigest, readOwnerCookie, visitCookie, readVisitCookie } = require('../server/telemetryIdentity');

function createProductEventsHandler({ getClient, getStore = createTelemetryStore, clock = Date.now } = {}) {
 let db, store;
 const recent = new Map();
 return async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  const origin=String(req.headers.origin||'');
  if(origin&&!/^https:\/\/(?:reelbot\.movie|movie-review-frontend[^/]*\.vercel\.app)$/.test(origin))return res.status(403).json({error:'Origin not allowed'});
  const body=typeof req.body==='string'?(()=>{try{return JSON.parse(req.body);}catch{return null;}})():req.body;
  if(Buffer.byteLength(JSON.stringify(body||{}),'utf8')>16384)return res.status(413).json({error:'Batch too large'});
  // Older consenting clients did not send this marker. Reject explicit rejection;
  // new clients always attest acceptance and still gate collection in the browser.
  if(body?.consent && body.consent!=='accepted')return res.status(400).json({error:'Analytics consent required'});
  const now=clock();const batch=normalizeBatch(body,now);
  if(!batch)return res.status(400).json({error:'Invalid events'});
  const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0];
  const entry=recent.get(ip);const value=entry&&now-entry.time<60000?entry:{time:now,count:0};
  if(value.count>=60)return res.status(429).json({error:'Too many batches'});
  value.count++;recent.set(ip,value);if(recent.size>2000)recent.delete(recent.keys().next().value);
  try {
   if(!store){
    const url=String(process.env.SUPABASE_URL||process.env.REACT_APP_SUPABASE_URL||'').trim().replace(/\/(?:rest\/v1)?\/?$/, '');
    const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!getClient&&(!url||!key))throw Error('Unavailable');
    db=getClient?getClient():createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});store=getStore(db);
   }
   let accountOwner='';
   const authorization=String(req.headers.authorization||'');
   if(/^Bearer\s+\S+$/i.test(authorization)){
    const check=await db.auth.getUser(authorization.replace(/^Bearer\s+/i,''));
    if(check.error||!check.data?.user)return res.status(401).json({error:'Session could not be verified'});
    accountOwner=ownerDigest(check.data.user.id);
   }
   const guestOwner=readOwnerCookie(req.headers.cookie,now);
   const hasAccountEvents=batch.events.some(e=>e.properties.authenticated);
   if(hasAccountEvents&&!accountOwner)return res.status(401).json({error:'Session could not be verified'});
   batch.events=batch.events.map(e=>({...e,...(e.properties.authenticated?{owner:accountOwner,account_owner:accountOwner}:guestOwner?{owner:guestOwner}:{}),properties:{...e.properties,authenticated:Boolean(e.properties.authenticated&&accountOwner)}}));
   const previousVisit=readVisitCookie(req.headers.cookie,now);
   const cookie=visitCookie(batch.session_id,now,previousVisit?.session===batch.session_id?previousVisit.continuity:undefined);
   batch.continuity_id=readVisitCookie(cookie,now).continuity;
   if(accountOwner&&hasAccountEvents){
    batch.identity_link={owner:accountOwner,at:Math.min(...batch.events.filter(e=>e.properties.authenticated).map(e=>e.time))};
   }
   await store.write(batch);
   res.setHeader('Set-Cookie',cookie);
   return res.status(202).json({ok:true});
  }catch(error){
   // Deliberately omit tokens, prompts, IPs, account IDs and upstream messages.
   console.error('Product telemetry persistence failed',{code:String(error?.code||'unavailable').slice(0,40)});
   return res.status(503).json({error:'Metrics temporarily unavailable'});
  }
 };
}
module.exports=createProductEventsHandler();
module.exports.createProductEventsHandler=createProductEventsHandler;
