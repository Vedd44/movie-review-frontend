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

test('pending Ask requests never count as completed recommendations or identifications',()=>{
 const pending=batch(1,[event(20,'ask_reelbot_submitted',{kind:'recommendation'}),event(21,'ask_reelbot_submitted',{kind:'identification'})]);
 const metrics=buildProductMetrics([pending],now);assert.equal(metrics.total.requests,1);assert.equal(metrics.total.completed,0);assert.equal(metrics.total.identifications,0);
 const finished=buildProductMetrics([pending,batch(1,[event(22,'ask_reelbot_result',{kind:'recommendation',outcome:'pick',latency_ms:8000}),event(23,'ask_reelbot_result',{kind:'identification',outcome:'identification'})])],now);assert.equal(finished.total.completed,1);assert.equal(finished.total.identifications,1);
});

test('request log pairs prompt and result, keeps source and later actions, and hides only verified owner activity',()=>{
 const mine=normalizeBatch({...batch(1,[event(101,'request_logged',{request_id:id(501),prompt:'A clever thriller',movie_id:5,movie_title:'The Prestige',kind:'recommendation',authenticated:true}),event(102,'movie_saved',{movie_id:5,authenticated:true})]),acquisition:{channel:'paid',source:'instagram',campaign:'test'}},now);
 mine.events.forEach(e=>{e.owner='verified-owner';});
 const guest=normalizeBatch(batch(2,[event(103,'request_logged',{request_id:id(502),prompt:'Is it scary?',result_text:'It is tense.',kind:'answer',authenticated:false})]),now);
 const all=buildProductMetrics([mine,guest],now,false,{viewerOwner:'verified-owner'});
 assert.equal(all.request_log.length,2);assert.equal(all.request_log.find(r=>r.is_mine).acquisition.channel,'paid');assert.deepEqual(all.request_log.find(r=>r.is_mine).actions,['Saved']);
 const hidden=buildProductMetrics([mine,guest],now,false,{viewerOwner:'verified-owner',excludeOwner:'verified-owner'});
 assert.equal(hidden.request_log.length,1);assert.equal(hidden.total.sessions,1);assert.equal(hidden.request_log[0].prompt,'Is it scary?');
 assert.equal(hidden.request_log[0].result_text,'It is tense.');
});
test('public clients cannot inject owner identity, private fields in ordinary metrics or arbitrary detail fields',()=>{
 const normalized=normalizeBatch({...batch(1,[{...event(200,'request_logged',{prompt:'Email a@b.com',account_id:'private',user_id:'owner'}),owner:'forged'}]),owner:'forged'},now);
 assert.equal(normalized.owner,undefined);assert.equal(normalized.events[0].owner,undefined);assert.equal(normalized.events[0].properties.user_id,undefined);
 assert.equal(normalized.events[0].properties.prompt,'Email [email removed]');
});
test('retention deletes expired private batches but leaves current dates intact',async()=>{
 const {pruneTelemetry}=require('./productTelemetry');const removed=[];
 const storage={list:async prefix=>({data:prefix===''?[{name:'2026-09-20'},{name:'2026-10-03'}]:[{name:'old.json'}]}),remove:async paths=>{removed.push(...paths);return {};}};
 await pruneTelemetry({storage:{from:()=>storage}},now);assert.deepEqual(removed,['2026-09-20/old.json']);
});
