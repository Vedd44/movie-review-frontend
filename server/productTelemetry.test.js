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

test('coverage describes optional consent, separate profile records and omitted catalog searches',()=>{
 const metrics=buildProductMetrics([],now);
 assert.match(metrics.coverage,/only analytics-consenting guest and signed-in sessions/);
 assert.match(metrics.coverage,/separate from functional account profile records/);
 assert.match(metrics.coverage,/Catalog searches are not recorded as requests/);
 assert.match(metrics.coverage,/reported for 7 days; stored batches are pruned after 8 days/);
 assert.match(metrics.coverage,/Up to 40 recent event batches per day/);
});

test('identification answers and failures use kind without affecting recommendation health',()=>{
 const metrics=buildProductMetrics([batch(1,[
  event(30,'recommendation_returned',{outcome:'pick',latency_ms:9000}),
  event(31,'ask_reelbot_result',{kind:'identification',latency_ms:1000}),
  event(32,'ask_reelbot_failed',{kind:'identification',outcome:'failed',latency_ms:2000}),
  event(33,'ask_reelbot_result',{kind:'identification',outcome:'no_match',latency_ms:3000}),
  event(34,'ask_reelbot_result',{kind:'answer',latency_ms:500}),
  event(35,'recommendation_failed',{kind:'identification',outcome:'no_match',latency_ms:1500}),
  event(36,'recommendation_failed',{kind:'identification',outcome:'failed',latency_ms:2500}),
 ])],now);
 assert.equal(metrics.total.identifications,5);
 assert.equal(metrics.total.completed,1);
 assert.equal(metrics.total.picks,1);
 assert.equal(metrics.total.failed,0);
 assert.equal(metrics.total.no_match,0);
 assert.equal(metrics.total.median_ms,9000);
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

test('watch views and provider clicks reach private metrics with source/type and owner exclusion',()=>{
 const mine=normalizeBatch(batch(1,[event(401,'watch_options_viewed',{movie_id:278,source:'watchmode'}),event(402,'provider_clicked',{movie_id:278,provider_id:203,provider_name:'Netflix',availability_type:'subscription',source:'watchmode',url:'https://private.example'})]),now);
 mine.events=mine.events.map(e=>({...e,owner:'mine'}));
 const guest=normalizeBatch(batch(2,[event(403,'watch_options_viewed',{movie_id:679,source:'tmdb'}),event(404,'viewing_options_clicked',{movie_id:679,source:'tmdb'})]),now);
 assert.equal(mine.events[1].properties.url,undefined);
 const all=buildProductMetrics([mine,guest],now);assert.equal(all.total.watch_views,2);assert.equal(all.total.provider_clicks,1);assert.equal(all.total.tmdb_clicks,1);assert.equal(all.provider_clicks[0].name,'Netflix');
 const hidden=buildProductMetrics([mine,guest],now,false,{excludeOwner:'mine'});assert.equal(hidden.total.watch_views,1);assert.equal(hidden.total.provider_clicks,0);assert.deepEqual(hidden.provider_clicks,[]);
});

test('follow-through includes alternate clicks, browsing and providers; stops when another request starts',()=>{
 const t=now-120000;
 const b=batch(1,[event(601,'request_logged',{movie_id:5,alternate_ids:[6]},t),event(602,'alternate_clicked',{movie_id:6},t+1000),event(603,'movie_detail_opened',{movie_id:6},t+2000),event(604,'page_viewed',{page:'movie'},t+2001),event(605,'provider_clicked',{movie_id:6,provider_name:'Tubi TV'},t+3000),event(606,'page_viewed',{page:'collection'},t+4000),event(607,'request_logged',{movie_id:7,started_at:t+5000},t+10000),event(608,'pick_details_clicked',{movie_id:5},t+7000)]);
 const metrics=buildProductMetrics([b,b],now);
 const row=metrics.request_log.find(r=>r.movie_id===5);
 assert.equal(row.follow_through.result_clicks,2);assert.equal(row.follow_through.opened_details,true);assert.equal(row.follow_through.continued_browsing,true);assert.equal(row.follow_through.page_views,2);assert.deepEqual(row.follow_through.clicked_providers,['Tubi TV']);assert.equal(row.follow_through.asked_again,true);assert.equal(row.follow_through.last_activity_seconds,4);
});
test('absent events, unrelated sessions and later visits never claim a bounce or result click',()=>{
 const t=now-3600000;
 const m=buildProductMetrics([batch(1,[event(701,'request_logged',{movie_id:5},t),event(702,'pick_details_clicked',{movie_id:5},t+31*60000)]),batch(2,[event(703,'provider_clicked',{movie_id:5},t+1000)])],now);
 const f=m.request_log[0].follow_through;
 assert.equal(f.result_clicks,0);assert.equal(f.recorded_activity,false);assert.equal(f.continued_browsing,false);assert.equal(f.last_activity_seconds,null);
 assert.equal(f.bounced,undefined);
});
test('request attribution bounds and alternate IDs are validated at ingestion',()=>{
 const n=normalizeBatch(batch(1,[event(801,'request_logged',{started_at:now+5000,alternate_ids:[5,-1,6,5,'7',8,9]},now-1000)]),now);
 assert.equal(n.events[0].properties.started_at,undefined);assert.deepEqual(n.events[0].properties.alternate_ids,[5,6,8]);
});


test('retries across UTC midnight retain one immutable storage key and one counted event',async()=>{
 const files=new Map();const paths=[];
 const db={storage:{getBucket:async()=>({data:{id:BUCKET}}),from:()=>({upload:async(path,body,options)=>{
  paths.push(path);assert.equal(options.upsert,false);
  if(files.has(path))return {error:{message:'The resource already exists'}};
  files.set(path,JSON.parse(body));return {};
 }})}};
 const before=Date.parse('2026-10-04T23:59:59Z');const after=before+5000;
 const body=batch(1,[event(1,'page_viewed',{page:'home'},before-1000)]);
 const store=createTelemetryStore(db);
 await store.write(normalizeBatch(body,before));
 await store.write(normalizeBatch(body,after));
 assert.equal(paths[0],paths[1]);assert.equal(files.size,1);
 assert.equal(buildProductMetrics([...files.values()],after).surfaces.find(s=>s.page==='home').views,1);
});
