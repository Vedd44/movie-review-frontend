const { createClient }=require('@supabase/supabase-js');
const { normalizeBatch,createTelemetryStore }=require('../server/productTelemetry');
let store;const recent=new Map();
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
 const origin=String(req.headers.origin||'');if(origin&&!/^https:\/\/(?:reelbot\.movie|movie-review-frontend[^/]*\.vercel\.app)$/.test(origin))return res.status(403).json({error:'Origin not allowed'});
 const body=typeof req.body==='string'?(()=>{try{return JSON.parse(req.body);}catch{return null;}})():req.body;
 if(JSON.stringify(body||{}).length>16384)return res.status(413).json({error:'Batch too large'});
 const batch=normalizeBatch(body);if(!batch)return res.status(400).json({error:'Invalid events'});
 const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0];const now=Date.now();const entry=recent.get(ip);const value=entry&&now-entry.time<60000?entry:{time:now,count:0};
 if(value.count>=60)return res.status(429).json({error:'Too many batches'});value.count++;recent.set(ip,value);if(recent.size>2000)recent.delete(recent.keys().next().value);
 try {
  if(!store){const url=String(process.env.SUPABASE_URL||process.env.REACT_APP_SUPABASE_URL||'').trim().replace(/\/(?:rest\/v1)?\/?$/, '');const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('Unavailable');store=createTelemetryStore(createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}));}
  await store.write(batch);return res.status(202).json({ok:true});
 }catch{return res.status(503).json({error:'Metrics temporarily unavailable'});}
};
