const test=require('node:test');
const assert=require('node:assert/strict');
const {createProductEventsHandler}=require('../api/product-events');
const {buildProductMetrics,readProductTelemetry,createTelemetryStore}=require('./productTelemetry');
const {ownerDigest,readVisitCookie}=require('./telemetryIdentity');
const now=Date.parse('2026-10-09T16:00:00Z');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const event=(n,name,p={},time=now-10000+n)=>({id:id(n),name,time,properties:p});
function fixture(){
 const files=new Map();
 const storage={upload:async(path,body)=>{if(files.has(path))return {error:{message:'already exists'}};files.set(path,body);return {};},list:async(prefix,{limit=100,offset=0}={})=>({data:[...files.keys()].filter(p=>p.startsWith(prefix+'/')).sort().slice(offset,offset+limit).map(p=>({name:p.split('/')[1]}))}),download:async path=>({data:{text:async()=>files.get(path)}})};
 const db={auth:{getUser:async token=>token==='bad'?{error:{message:'invalid'}}:{data:{user:{id:token}}}},storage:{getBucket:async()=>({data:{public:false}}),from:()=>storage}};
 const handler=createProductEventsHandler({getClient:()=>db,clock:()=>now});
 return {db,files,send:async(session,batch,events,{token,cookie,consent='accepted'}={})=>{
  const req={method:'POST',headers:{origin:'https://reelbot.movie',...(token?{authorization:`Bearer ${token}`} : {}),cookie},body:{session_id:id(session),batch_id:id(batch),consent,acquisition:{channel:'paid',source:'test',campaign:'isolated'},events}};
  const res={status(code){this.code=code;return this;},setHeader(key,value){this[key]=value;},json(body){this.body=body;return this;}};
  await handler(req,res);return res;
 }};
}
test('isolated A–F, I–J journeys persist once, refresh, and link only signed same-visit continuity',async()=>{
 const previous=process.env.SUPABASE_SECRET_KEY;process.env.SUPABASE_SECRET_KEY='isolated-test-secret';
 try{
  const f=fixture();assert.equal((await readProductTelemetry(f.db,now)).request_log.length,0);
  const guest=await f.send(1,101,[event(1,'request_logged',{page:'home',prompt:'First',outcome:'pick',kind:'recommendation'}),event(2,'request_logged',{page:'home',prompt:'Second',outcome:'no_match',kind:'recommendation'})]);
  assert.equal(guest.code,202);const cookie=guest['Set-Cookie'];assert.equal(readVisitCookie(cookie,now).session,id(1));
  const events=[event(9,'sign_up',{authenticated:true,method:'email'}),event(3,'login',{authenticated:true,method:'google'}),event(4,'request_logged',{page:'browse',prompt:'Browse',authenticated:true,kind:'recommendation',outcome:'pick'})];
  assert.equal((await f.send(1,102,events,{token:'account-a',cookie})).code,202);
  await f.send(1,102,events,{token:'account-a',cookie});
  await f.send(2,103,[event(5,'request_logged',{page:'home',prompt:'Unrelated guest'})]);
  await f.send(3,104,[event(6,'request_logged',{page:'ask',prompt:'Ask',authenticated:true,kind:'recommendation',outcome:'pick'}),event(7,'request_logged',{page:'ask',prompt:'Follow up',authenticated:true,kind:'answer',outcome:'answer'})],{token:'account-a'});
  const refreshed=await readProductTelemetry(f.db,now);
  assert.equal(f.files.size,4);assert.equal(refreshed.request_log.length,6);
  assert.equal(refreshed.request_log.filter(r=>r.linked_account_ref).length,2);
  assert.equal(refreshed.request_log.find(r=>r.prompt==='Unrelated guest').linked_account_ref,null);
  assert.equal(refreshed.request_log.find(r=>r.prompt==='Follow up').page,'ask');assert.equal(refreshed.total.logins,1);assert.equal(refreshed.total.signups,1);assert.deepEqual(refreshed.accounts[ownerDigest('account-a')],{page_views:0,requests:3,linked_guest_requests:2,sessions:2});
  const hidden=await readProductTelemetry(f.db,now,{excludeOwners:[ownerDigest('account-a')]});assert.equal(hidden.request_log.length,1);
  await f.send(2,105,[event(8,'login',{authenticated:true})],{token:'account-b'});
  assert.equal((await readProductTelemetry(f.db,now)).request_log.find(r=>r.prompt==='Unrelated guest').linked_account_ref,null);
 }finally{if(previous===undefined)delete process.env.SUPABASE_SECRET_KEY;else process.env.SUPABASE_SECRET_KEY=previous;}
});
test('ingestion rejects declined consent and unverified identity without persistence',async()=>{
 const f=fixture();
 assert.equal((await f.send(1,1,[event(1,'page_viewed')],{consent:'rejected'})).code,400);
 assert.equal((await f.send(1,2,[event(2,'page_viewed',{authenticated:true})])).code,401);
 assert.equal((await f.send(1,3,[event(3,'page_viewed',{authenticated:true})],{token:'bad'})).code,401);
 assert.equal(f.files.size,0);
});
test('conflicting accounts in one signed visit never merge guest history',()=>{
 const a='a'.repeat(64),b='b'.repeat(64),visit=id(100);
 const batches=[{session_id:id(1),continuity_id:visit,events:[event(1,'request_logged',{prompt:'guest'})]},...[[a,2],[b,3]].map(([owner,n])=>({session_id:id(1),continuity_id:visit,identity_link:{owner,at:now},events:[{...event(n,'login',{authenticated:true}),account_owner:owner}]}))];
 assert.equal(buildProductMetrics(batches,now).request_log[0].linked_account_ref,null);
});
test('pagination reads beyond 40 and 100 batches; new events appear on the next uncached read',async()=>{
 const f=fixture();const store=createTelemetryStore(f.db);
 for(let n=1;n<=125;n++)await store.write({v:2,session_id:id(n),batch_id:id(n),received_at:new Date(now).toISOString(),events:[event(n,'request_logged',{prompt:`Request ${n}`})]});
 let result=await readProductTelemetry(f.db,now);assert.equal(result.request_log.length,125);assert.equal(result.capped,false);
 await store.write({v:2,session_id:id(126),batch_id:id(126),received_at:new Date(now).toISOString(),events:[event(126,'request_logged',{prompt:'New request'})]});
 result=await readProductTelemetry(f.db,now);assert.equal(result.request_log.length,126);assert.equal(result.request_log[0].prompt,'New request');
});
