const test=require('node:test');const assert=require('node:assert/strict');
const {normalizeBatch,buildProductMetrics,createTelemetryStore,BUCKET}=require('./productTelemetry');
const now=Date.parse('2026-10-04T02:30:00Z');const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const event=(n,name,p={},time=now-10000+n)=>({id:id(n),name,time,properties:p});
const batch=(session,events)=>({session_id:id(session),batch_id:id(session+100),events});
test('public ingestion is bounded and drops prompts, account IDs, URLs and arbitrary properties',()=>{
 const normalized=normalizeBatch(batch(1,[event(1,'recommendation_returned',{page:'home',outcome:'pick',latency_ms:8500,prompt:'private message',email:'private@email',user_id:'account',url:'/p/private',authenticated:false})]),now);
 assert.deepEqual(normalized.events[0].properties,{page:'home',outcome:'pick',authenticated:false,latency_ms:8500});
 assert.equal(normalizeBatch({...batch(1,[]),events:[]},now),null);
 assert.equal(normalizeBatch(batch(1,[event(1,'made_up')]),now),null);
 assert.equal(normalizeBatch(batch(1,Array(31).fill(event(1,'page_viewed'))),now),null);
 assert.equal(normalizeBatch(batch(1,[event(1,'page_viewed',{},now-86400001)]),now),null);
});
test('guest, signed-in, identification and action cohorts stay separate; replayed events cannot inflate counts',()=>{
 const guest=batch(1,[event(1,'page_viewed',{authenticated:false}),event(2,'pick_chosen',{movie_id:5,authenticated:false}),event(3,'pick_presented',{movie_id:5,authenticated:false}),event(4,'pick_chosen',{movie_id:5,authenticated:false}),event(5,'movie_detail_opened',{movie_id:5,authenticated:false}),event(6,'recommendation_returned',{outcome:'pick',latency_ms:9000,authenticated:false}),event(7,'recommendation_returned',{outcome:'identification',latency_ms:4000,authenticated:false})]);
 const account=batch(2,[event(10,'pick_presented',{movie_id:5,authenticated:true}),event(11,'movie_saved',{movie_id:5,authenticated:true}),event(12,'recommendation_failed',{outcome:'failed',latency_ms:12000,authenticated:true})]);
 const metrics=buildProductMetrics([guest,guest,account],now);
 assert.equal(metrics.guests.sessions,1);assert.equal(metrics.signed_in.sessions,1);assert.equal(metrics.total.presented,2);assert.equal(metrics.total.chosen,1);assert.equal(metrics.guests.saved,0);assert.equal(metrics.signed_in.saved,1);assert.equal(metrics.total.watched,0);assert.equal(metrics.total.completed,2);assert.equal(metrics.total.identifications,1);assert.equal(metrics.guests.median_ms,9000);
 assert.equal(buildProductMetrics([],now).total.median_ms,null);
});
test('private immutable event storage is lazy and propagates unavailable storage',async()=>{
 const calls=[];const db={storage:{getBucket:async()=>({error:{message:'missing'}}),createBucket:async(name,options)=>{calls.push({name,options});return {};},from:name=>({upload:async(path,body,options)=>{calls.push({name,path,body,options});return {};}})}};
 const store=createTelemetryStore(db);assert.equal(calls.length,0);await store.write(normalizeBatch(batch(1,[event(1,'page_viewed')]),now));
 assert.equal(calls[0].name,BUCKET);assert.equal(calls[0].options.public,false);assert.equal(calls[1].options.upsert,false);assert.match(calls[1].path,/2026-10-04/);
});
test('stored guest batches are readable only through the private admin-side aggregation path',async()=>{
 const {readProductTelemetry}=require('./productTelemetry');const files=new Map();
 const db={storage:{getBucket:async()=>({data:{id:BUCKET}}),from:()=>({upload:async(path,body)=>{files.set(path,body);return {};},list:async(prefix)=>({data:[...files.keys()].filter(p=>p.startsWith(prefix+'/')).map(p=>({name:p.split('/')[1]}))}),download:async(path)=>({data:{text:async()=>files.get(path)}})})}};
 await createTelemetryStore(db).write(normalizeBatch(batch(1,[event(1,'page_viewed',{page:'home',authenticated:false}),event(2,'recommendation_returned',{outcome:'pick',latency_ms:8000,authenticated:false})]),now));
 const result=await readProductTelemetry(db,now);assert.equal(result.guests.sessions,1);assert.equal(result.signed_in.sessions,0);assert.equal(result.total.completed,1);assert.equal(result.total.median_ms,8000);assert.equal(result.capped,false);
});
