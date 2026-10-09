const {sanitizeAcquisition,sanitizeRequestDetails}=require('../src/telemetryDetails');
const BUCKET = 'reelbot-product-events';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTS = new Set(['page_viewed','recommendation_requested','recommendation_returned','recommendation_failed','pick_presented','pick_chosen','pick_choice_removed','another_pick_clicked','refine_clicked','alternate_clicked','pick_details_clicked','pick_trailer_clicked','movie_detail_opened','save_clicked','movie_saved','movie_unsaved','movie_watched','movie_unwatched','not_for_me_added','not_for_me_removed','pick_shared','watch_options_clicked','watch_options_viewed','provider_clicked','viewing_options_clicked','ask_reelbot_submitted','ask_reelbot_result','ask_reelbot_failed','request_logged','signup_started','signup_confirmation_requested','sign_up','login','browse_used','feedback_submitted']);
const SURFACES = new Set(['home','browse','collection','movie','person','shared_pick','my_movies','search','other','ask']);
function normalizeBatch(body, now=Date.now()) {
 if (!UUID.test(body?.session_id || '') || !UUID.test(body?.batch_id || '') || !Array.isArray(body.events) || !body.events.length || body.events.length>30) return null;
 const events=[];
 for(const event of body.events) {
  if(!UUID.test(event?.id || '') || !EVENTS.has(event.name)) return null;
  const time=Number(event.time);if(!Number.isFinite(time)||time<now-86400000||time>now+60000)return null;
  const p=event.properties || {}; const properties={};
  if(SURFACES.has(p.page))properties.page=p.page;
  if(['initial','another_pick','refinement'].includes(p.request_type))properties.request_type=p.request_type;
  if(['pick','no_match','failed','fallback','identification','answer'].includes(p.outcome))properties.outcome=p.outcome;
  if(['answer','recommendation','identification'].includes(p.kind))properties.kind=p.kind;
  if(['runtime','family','similarity','tone','general','surprise'].includes(p.prompt_category))properties.prompt_category=p.prompt_category;
  if(UUID.test(p.request_id||''))properties.request_id=p.request_id;
  if(['email','google'].includes(p.method))properties.method=p.method;
  if(typeof p.authenticated==='boolean')properties.authenticated=p.authenticated;
  if(Number.isSafeInteger(p.movie_id)&&p.movie_id>0)properties.movie_id=p.movie_id;
  if(Number.isFinite(p.latency_ms)&&p.latency_ms>=0&&p.latency_ms<=180000)properties.latency_ms=Math.round(p.latency_ms);
  if (Number.isSafeInteger(p.provider_id) && p.provider_id > 0) properties.provider_id=p.provider_id;
  if (typeof p.provider_name === 'string') properties.provider_name=p.provider_name.slice(0,120);
  if (['subscription','rent','buy','free','cable'].includes(p.availability_type)) properties.availability_type=p.availability_type;
  if (['watchmode','tmdb'].includes(p.source)) properties.source=p.source;
  if(event.name === "request_logged") { Object.assign(properties,sanitizeRequestDetails(p)); if(properties.started_at>time || properties.started_at<time-600000) delete properties.started_at; }
  events.push({id:event.id,name:event.name,time,properties});
 }
 return {v:2,consent:body.consent==='accepted'?'accepted':'legacy_client',acquisition:sanitizeAcquisition(body.acquisition),session_id:body.session_id,batch_id:body.batch_id,received_at:new Date(now).toISOString(),events};
}
function createTelemetryStore(db) {
 let ready, cleanedDay;
 return {async write(batch) {
  if(!ready)ready=(async()=>{const found=await db.storage.getBucket(BUCKET);if(!found.error){if(found.data?.public)throw Error('Activity storage must be private');return;}const created=await db.storage.createBucket(BUCKET,{public:false,fileSizeLimit:16384,allowedMimeTypes:['application/json']});if(created.error&&!/already exists|duplicate/i.test(created.error.message || ''))throw created.error;})().catch(error=>{ready=null;throw error;});
  await ready;
  // Immutable event time keeps retries idempotent across UTC midnight.
  const eventDay=new Date(Math.max(...batch.events.map(event=>event.time))).toISOString().slice(0,10);
  const path=`${eventDay}/${batch.batch_id}.json`;
  const result=await db.storage.from(BUCKET).upload(path,JSON.stringify(batch),{contentType:'application/json',upsert:false});
  if(result.error&&!/already exists|duplicate/i.test(result.error.message || ''))throw result.error;
  if(cleanedDay!==batch.received_at.slice(0,10)){cleanedDay=batch.received_at.slice(0,10);await pruneTelemetry(db,Date.parse(batch.received_at)).catch(()=>{console.warn('Product telemetry retention cleanup failed');});}
 }};
}
async function pruneTelemetry(db, now=Date.now()) {
 const storage=db.storage.from(BUCKET);if(!storage.list||!storage.remove)return;
 const roots=await storage.list('',{limit:1000});if(roots.error)throw roots.error;
 const cutoff=new Date(now-8*86400000).toISOString().slice(0,10);
 for(const folder of (roots.data||[]).filter(f=>/^\d{4}-\d{2}-\d{2}$/.test(f.name)&&f.name<=cutoff).slice(0,8)) {
  for(let page=0;page<10;page++){
   const files=await storage.list(folder.name,{limit:1000});if(files.error)throw files.error;
   const paths=(files.data||[]).filter(f=>/\.json$/.test(f.name)).map(f=>`${folder.name}/${f.name}`);if(!paths.length)break;
   const removed=await storage.remove(paths);if(removed.error)throw removed.error;if(paths.length<1000)break;
  }
 }
}
async function readProductTelemetry(db, now=Date.now(), options={}) {
 if(!db.storage)return null;
 const storage=db.storage.from(BUCKET);const files=[];let capped=false;
 // Read complete pages rather than silently taking the latest 40 batches.
 // Bound admin work; a truncated result must be labelled incomplete.
 await Promise.all(Array.from({length:8},async(_,day)=>{
  const prefix=new Date(now-day*86400000).toISOString().slice(0,10);
  for(let offset=0;offset<2000;offset+=100){
   const result=await storage.list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
   if(result.error)throw result.error;
   const page=result.data||[];
   files.push(...page.filter(f=>/\.json$/.test(f.name)).map(f=>`${prefix}/${f.name}`));
   if(page.length<100)break;
   if(offset===1900)capped=true;
  }
 }));
 const batches=[];let index=0;
 await Promise.all(Array.from({length:Math.min(8,files.length)},async()=>{while(index<files.length){const path=files[index++];const r=await storage.download(path);if(r.error)throw r.error;const b=JSON.parse(await r.data.text());if([1,2].includes(b.v)&&UUID.test(b.session_id)&&Array.isArray(b.events))batches.push(b);}}));
 return buildProductMetrics(batches,now,capped,options);
}
function buildProductMetrics(batches,now=Date.now(),capped=false,options={}) {
 const entries=new Map(), links=new Map(), owners=new Map();
 const validOwner=value=>/^[a-f0-9]{64}$/.test(value||'');
 const visitKey=b=>UUID.test(b.continuity_id||'')?`${b.session_id}:${b.continuity_id}`:null;
 for(const b of batches){
  const visit=visitKey(b);if(!visit)continue;
  for(const e of b.events||[]){
   if(e.properties?.authenticated&&validOwner(e.account_owner)){
    if(!owners.has(visit))owners.set(visit,new Set());
    owners.get(visit).add(e.account_owner);
   }
  }
  if(validOwner(b.identity_link?.owner)&&Number.isFinite(b.identity_link?.at)){
   if(!owners.has(visit))owners.set(visit,new Set());
   owners.get(visit).add(b.identity_link.owner);
   const old=links.get(visit);
   if(!old||b.identity_link.at<old.at)links.set(visit,b.identity_link);
  }
 }
 for(const b of batches)for(const e of b.events || [])if(EVENTS.has(e.name)&&e.time>=now-7*86400000&&e.time<=now){
  const visit=visitKey(b);
  const link=visit?links.get(visit):null;
  const linkedOwner=!e.properties?.authenticated&&link&&owners.get(visit)?.size===1&&e.time<=link.at?link.owner:null;
  const accountOwner=e.account_owner || (e.properties?.authenticated?e.owner:null) || null;
  if(options.excludeOwner&&(e.owner===options.excludeOwner||linkedOwner===options.excludeOwner))continue;
  if(options.excludeOwners?.includes(e.owner)||options.excludeOwners?.includes(linkedOwner))continue;
  entries.set(e.id,{...e,account_owner:accountOwner,linked_owner:linkedOwner,session:b.session_id,acquisition:sanitizeAcquisition(b.acquisition),is_mine:Boolean(options.viewerOwner&&(e.owner===options.viewerOwner||linkedOwner===options.viewerOwner))});
 }
 const events=[...entries.values()].sort((a,b)=>a.time-b.time);
 const summary=group=>{
  const scoped=events.filter(e=>group==='all'||Boolean(e.properties.authenticated)===(group==='signed_in'));
  const sessions=new Set(scoped.map(e=>e.session));
  const requested=scoped.filter(e=>e.name==='recommendation_requested'||e.name==='ask_reelbot_submitted'&&e.properties.kind==='recommendation');
  const outcomes=scoped.filter(e=>e.name==='recommendation_returned'||e.name==='recommendation_failed'||(['ask_reelbot_result','ask_reelbot_failed'].includes(e.name)&&['recommendation','identification'].includes(e.properties.kind)));
  const recommendation=outcomes.filter(e=>e.properties.kind!=='identification'&&e.properties.outcome!=='identification');
  const times=recommendation.map(e=>e.properties.latency_ms).filter(t=>Number.isFinite(t)&&t>0).sort((a,b)=>a-b);
  const percentile=p=>times.length?times[Math.min(times.length-1,Math.ceil(times.length*p)-1)]:null;
  const picks=new Map();for(const e of scoped){const id=e.properties.movie_id;if(!id)continue;const key=`${e.session}:${id}`;
   if(e.name==='pick_presented'&&!picks.has(key))picks.set(key,{chosen:false,details:false,saved:false,watched:false,swap:false});
   const p=picks.get(key);if(!p)continue;
   if(e.name==='pick_chosen')p.chosen=true;
   if(e.name==='pick_choice_removed')p.chosen=false;
   if(e.name==='movie_detail_opened'||e.name==='pick_details_clicked')p.details=true;
   if(e.name==='movie_saved')p.saved=true;
   if(e.name==='movie_watched')p.watched=true;
  }
  return {signups:scoped.filter(e=>e.name==='sign_up').length,signup_attempts:scoped.filter(e=>e.name==='signup_started').length,confirmation_requests:scoped.filter(e=>e.name==='signup_confirmation_requested').length,logins:scoped.filter(e=>e.name==='login').length,browse_interactions:scoped.filter(e=>e.name==='browse_used').length,feedback_submissions:scoped.filter(e=>e.name==='feedback_submitted').length,watch_views:scoped.filter(e=>e.name==='watch_options_viewed').length,provider_clicks:scoped.filter(e=>e.name==='provider_clicked').length,tmdb_clicks:scoped.filter(e=>e.name==='viewing_options_clicked').length,sessions:sessions.size,page_views:scoped.filter(e=>e.name==='page_viewed').length,requests:requested.length,completed:recommendation.length,picks:recommendation.filter(e=>['pick','fallback'].includes(e.properties.outcome)).length,no_match:recommendation.filter(e=>e.properties.outcome==='no_match').length,failed:recommendation.filter(e=>e.properties.outcome==='failed'||e.name==='recommendation_failed'&&!e.properties.outcome).length,identifications:outcomes.filter(e=>e.properties.kind==='identification'||e.properties.outcome==='identification').length,median_ms:percentile(.5),p95_ms:percentile(.95),presented:picks.size,chosen:[...picks.values()].filter(p=>p.chosen).length,details:[...picks.values()].filter(p=>p.details).length,saved:[...picks.values()].filter(p=>p.saved).length,watched:[...picks.values()].filter(p=>p.watched).length,save_attempts:scoped.filter(e=>e.name==='save_clicked').length,swaps:scoped.filter(e=>e.name==='another_pick_clicked').length,refinements:scoped.filter(e=>e.name==='refine_clicked').length,shares:scoped.filter(e=>e.name==='pick_shared').length};
 };
 const surfaces=[...SURFACES].map(page=>{const views=events.filter(e=>e.name==='page_viewed'&&e.properties.page===page);return {page,views:views.length,guest_sessions:new Set(views.filter(e=>!e.properties.authenticated).map(e=>e.session)).size};}).filter(row=>row.views).sort((a,b)=>b.views-a.views);
 const requests=events.filter(e=>e.name==='request_logged');
 const accounts={};
 for(const e of events){
  const owner=e.account_owner||e.linked_owner;if(!owner)continue;
  const key=owner;const row=accounts[key]||(accounts[key]={page_views:0,requests:0,linked_guest_requests:0,sessions:new Set()});
  row.sessions.add(e.session);
  if(e.name==='page_viewed'&&e.account_owner)row.page_views++;
  if(e.name==='request_logged'){if(e.account_owner)row.requests++;else row.linked_guest_requests++;}
 }
 for(const row of Object.values(accounts))row.sessions=row.sessions.size;
 const bySession=new Map();for(const e of events){if(!bySession.has(e.session))bySession.set(e.session,[]);bySession.get(e.session).push(e);}
 const requestsBySession=new Map();for(const e of requests){if(!requestsBySession.has(e.session))requestsBySession.set(e.session,[]);requestsBySession.get(e.session).push(e);}

 const actionLabels={movie_saved:'Saved',pick_chosen:'Chosen to watch',pick_details_clicked:'Opened details',movie_detail_opened:'Opened details',another_pick_clicked:'Asked for another',watch_options_clicked:'Opened watch options',pick_shared:'Shared',provider_clicked:'Opened streaming service',viewing_options_clicked:'Opened TMDB viewing options'};
 const requestLog=requests.map((e,index)=>{
  const start = Number.isFinite(e.properties.started_at) ? e.properties.started_at : e.time;
  const next = (requestsBySession.get(e.session)||[]).filter(item=> (item.properties.started_at || item.time)>start)
    .sort((a,b)=>(a.properties.started_at || a.time)-(b.properties.started_at || b.time))[0];
  const nextStart = next ? next.properties.started_at || next.time : Infinity;
  const end = Math.min(nextStart,e.time+30*60000);
  const later = (bySession.get(e.session)||[]).filter(item=>item.time>e.time && item.time<end);
  const resultIds = new Set([e.properties.movie_id,...(e.properties.alternate_ids || []),...later.filter(item=>item.name==='alternate_clicked').map(item=>item.properties.movie_id)].filter(Boolean));
  const resultAction = item => !item.properties.movie_id || resultIds.has(item.properties.movie_id);
  const actions = [...new Set(later.filter(item=>actionLabels[item.name] && resultAction(item)).map(item=>actionLabels[item.name]))];
  const clicks = later.filter(item=>['pick_details_clicked','alternate_clicked','pick_trailer_clicked','provider_clicked','viewing_options_clicked'].includes(item.name) && resultAction(item));
  const pages = later.filter(item=>item.name==='page_viewed');
  const destinations = [...new Set(pages.map(item=>item.properties.page).filter(Boolean))];
  const followThrough = {
    result_clicks: clicks.length,
    opened_details: later.some(item=>['pick_details_clicked','movie_detail_opened'].includes(item.name) && resultIds.has(item.properties.movie_id)),
    continued_browsing: pages.length>0 || later.some(item=>item.name==='movie_detail_opened' && !resultIds.has(item.properties.movie_id)),
    page_views: pages.length, destinations,
    clicked_providers: [...new Set(later.filter(item=>item.name==='provider_clicked' && resultAction(item)).map(item=>item.properties.provider_name || 'Streaming service'))],
    asked_again: nextStart<=e.time+30*60000,
    last_activity_seconds: later.length ? Math.round((later[later.length-1].time-e.time)/1000) : null,
    recorded_activity: later.some(item=>!['pick_presented','recommendation_returned','ask_reelbot_result'].includes(item.name)) || nextStart<=e.time+30*60000,
  };
  return {id:e.properties.request_id||e.id,session:e.session.slice(0,8),account_ref:e.account_owner?.slice(0,12)||null,linked_account_ref:e.linked_owner?.slice(0,12)||null,time:new Date(e.time).toISOString(),is_mine:e.is_mine,acquisition:e.acquisition,actions,...e.properties,follow_through:followThrough};
 }).reverse();
 const providerClicks=new Map();
 for(const event of events.filter(e=>e.name==='provider_clicked')) {
  const p=event.properties; const key=`${p.source}:${p.provider_id}:${p.availability_type}`;
  const row=providerClicks.get(key)||{source:p.source,provider_id:p.provider_id,name:p.provider_name||'Provider',availability_type:p.availability_type,clicks:0};
  row.clicks++;providerClicks.set(key,row);
 }
 return {batches_read:batches.length,accounts,generated_at:new Date(now).toISOString(),window_start:new Date(now-7*86400000).toISOString(),request_count:requests.length,request_log_capped:false,provider_clicks:[...providerClicks.values()].sort((a,b)=>b.clicks-a.clicks),request_log:requestLog,surfaces,scope:'Consented browser activity · rolling 7 days',coverage:`Read ${batches.length} stored event batches. Includes only analytics-consenting guest and signed-in sessions, separate from functional account profile records. Catalog searches are not recorded as recommendation requests. Sessions are visits in a browser tab, not unique people. A visitor who signs in can appear in both groups. Consented request text and results are redacted and shown only to super admins. Account IDs and full referral URLs are not stored. Activity is reported for 7 days; stored batches are pruned after 8 days. All pages are read up to a safety limit of 2,000 batches per UTC day; ${capped?'INCOMPLETE: this limit was reached.':'all retained batches in this window were read.'} Signed account references are pseudonymous; guest links require signed same-visit continuity, and ambiguous multi-account visits are not linked. Blocked tracking and missing browser events are excluded.`,capped,total:summary('all'),guests:summary('guest'),signed_in:summary('signed_in')};
}
module.exports={BUCKET,EVENTS,normalizeBatch,createTelemetryStore,readProductTelemetry,buildProductMetrics,pruneTelemetry};
