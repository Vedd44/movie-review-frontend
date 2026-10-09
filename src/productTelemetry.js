import { getSupabaseClient } from './lib/supabaseClient';
import { acquisitionFromLocation, sanitizeRequestDetails } from './telemetryDetails';
import { hasAnalyticsConsent, subscribeCookieChoice } from './cookieConsent';
// Private admin request details are separate from external analytics.
const ALLOWED=new Set(['page_viewed','recommendation_requested','recommendation_returned','recommendation_failed','pick_presented','pick_chosen','pick_choice_removed','another_pick_clicked','refine_clicked','alternate_clicked','pick_details_clicked','pick_trailer_clicked','movie_detail_opened','save_clicked','movie_saved','movie_unsaved','movie_watched','movie_unwatched','not_for_me_added','not_for_me_removed','pick_shared','watch_options_clicked','watch_options_viewed','provider_clicked','viewing_options_clicked','ask_reelbot_submitted','ask_reelbot_result','ask_reelbot_failed','request_logged','signup_started','signup_confirmation_requested','sign_up','login','browse_used','feedback_submitted']);
const initialAcquisition=typeof window!=="undefined"?acquisitionFromLocation(window.location.href,document.referrer):null;
let acquisition=null;
let queue=[],timer=null,sending=false,authenticated=false,sessionId='',initialized=false;
let pendingBatch=null,consentGeneration=0,deliveryController=null;
const activeRequests=new Set();
const MAX_DELIVERY_ATTEMPTS=3;
let accountId='';
const diagnostic=reason=>{try{console.warn('ReelBot analytics delivery:',reason);}catch{}};
export function setAnalyticsIdentity(id='') {
 if(accountId&&accountId!==id){discardTelemetry();sessionId='';try{window.sessionStorage.removeItem('reelbot:metrics-session');}catch{}}
 accountId=id;authenticated=Boolean(id);
}
const uuid=()=>window.crypto?.randomUUID?.() || '';
export const telemetrySurface=path=>path==='/'?'home':path.startsWith('/p/')?'shared_pick':path.startsWith('/browse')?'browse':path.startsWith('/collections/')?'collection':path.startsWith('/movies/')||path.startsWith('/movie/')?'movie':path.startsWith('/people/')||path.startsWith('/person/')?'person':path==='/my-movies'?'my_movies':path==='/search'?'search':'other';
export const setAnalyticsAuthenticated=value=>{authenticated=Boolean(value);};
export function sanitizeTelemetryProperties(p={}) {
 const safe={};for(const key of ['movie_id','latency_ms','request_type','outcome','kind','prompt_category','provider_id','provider_name','availability_type','source','method'])if(['string','number'].includes(typeof p[key]))safe[key]=p[key];
 safe.authenticated=typeof p.authenticated==='boolean'?p.authenticated:authenticated;
 safe.page=['home','browse','collection','movie','person','shared_pick','my_movies','search','ask'].includes(p.page)?p.page:telemetrySurface(window.location.pathname);
 return safe;
}
function schedule(){if(!timer)timer=setTimeout(()=>{timer=null;void flush();},5000);}
function getAcquisition() {
 if(acquisition)return acquisition;
 try { acquisition=JSON.parse(window.sessionStorage.getItem('reelbot:metrics-acquisition')||'null'); } catch {}
 if(!acquisition){acquisition=initialAcquisition||acquisitionFromLocation(window.location.href,document.referrer);try{window.sessionStorage.setItem('reelbot:metrics-acquisition',JSON.stringify(acquisition));}catch{}}
 return acquisition;
}
export const createActivityRequestId = () => uuid();
export function recordRequestActivity(details) {
 recordProductTelemetry('request_logged', details);
}
// Request-scoped performance deferral, not an analytics event. Aborted or stale
// requests must release their own slot without completing another active request.
export function deferProductTelemetry(signal) {
 const request=Symbol('request');
 activeRequests.add(request);
 const finish=()=>{activeRequests.delete(request);signal?.removeEventListener('abort',finish);if(queue.length||pendingBatch)schedule();};
 if(signal?.aborted)finish();else signal?.addEventListener('abort',finish,{once:true});
 return finish;
}
function discardTelemetry() {
 queue=[];pendingBatch=null;consentGeneration++;
 deliveryController?.abort();
 if(timer)clearTimeout(timer);timer=null;
}
async function flush(force=false) {
 if(!hasAnalyticsConsent()){discardTelemetry();return;}
 if((!queue.length&&!pendingBatch)||sending||(activeRequests.size&&!force)){if(queue.length||pendingBatch)schedule();return;}
 if(!pendingBatch){
  const events=[];let size=0;
  while(queue.length&&events.length<30){const next=new Blob([JSON.stringify(queue[0])]).size;if(events.length&&size+next>11000)break;events.push(queue.shift());size+=next;}
  pendingBatch={events,accountId,body:JSON.stringify({consent:'accepted',session_id:sessionId,batch_id:uuid(),acquisition:getAcquisition(),events}),attempts:0,generation:consentGeneration};
 }
 const batch=pendingBatch;
 const controller=new AbortController();deliveryController=controller;
 const timeout=setTimeout(()=>controller.abort(),10000);
 sending=true;batch.attempts++;
 let retry=false;
 try {
  const deliver=async()=>{
  // Retrying must not attribute an earlier account's batch to a newly signed-in
  // account. Resolve headers once per batch; keep them only in this memory queue.
  if(!batch.headersPromise)batch.headersPromise=(async()=>{
   const headers={'Content-Type':'application/json'};
   if(batch.events.some(e=>e.properties.authenticated)){
    try{const client=await getSupabaseClient();const session=await client?.auth.getSession();if(batch.accountId&&session?.data?.session?.user?.id!==batch.accountId){diagnostic('Account changed; batch discarded');return null;}if(session?.data?.session?.access_token)headers.Authorization=`Bearer ${session.data.session.access_token}`;}catch{}
   }
   return headers;
  })();
  const headers=await batch.headersPromise;
  if(!headers||!hasAnalyticsConsent()||batch.generation!==consentGeneration||controller.signal.aborted)return;
  const response=await fetch('/api/product-events',{method:'POST',headers,body:batch.body,keepalive:true,signal:controller.signal});
  if(!response.ok)diagnostic(`HTTP ${response.status}`);
  retry=!response.ok&&(response.status===408||response.status===429||response.status>=500);
  };
  await Promise.race([deliver(),new Promise((resolve,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('Telemetry delivery aborted')),{once:true}))]);
 }catch{diagnostic('Delivery unavailable; bounded retry');retry=true;/* Metrics cannot interrupt choosing a movie. */}
 finally{
  clearTimeout(timeout);deliveryController=null;sending=false;
  // Keep the exact IDs/body for bounded, in-memory retry. Withdrawal permanently
  // discards this generation, even when consent is granted again before settling.
  if(pendingBatch===batch&&(!retry||batch.attempts>=MAX_DELIVERY_ATTEMPTS||!hasAnalyticsConsent()||batch.generation!==consentGeneration))pendingBatch=null;
  if(queue.length||pendingBatch)schedule();
 }
}
export function recordProductTelemetry(name,p={}) {
 if(!hasAnalyticsConsent()||process.env.NODE_ENV!=='production'||typeof window==='undefined'||!ALLOWED.has(name)||window.location.pathname.startsWith('/admin'))return;
 try {
  getAcquisition();
  if(!sessionId){sessionId=window.sessionStorage.getItem('reelbot:metrics-session')||uuid();if(!sessionId)return;window.sessionStorage.setItem('reelbot:metrics-session',sessionId);}
  if(!initialized){initialized=true;window.addEventListener('pagehide',()=>{void flush(true);});subscribeCookieChoice(()=>{if(!hasAnalyticsConsent()){discardTelemetry();sessionId='';acquisition=null;try{window.sessionStorage.removeItem('reelbot:metrics-session');window.sessionStorage.removeItem('reelbot:metrics-acquisition');}catch{}}});}
  queue.push({id:uuid(),name,time:Date.now(),properties:{...sanitizeTelemetryProperties(p),...(name==='request_logged'?sanitizeRequestDetails(p):{})}});if(queue.length>90)queue=queue.slice(-90);schedule();
 }catch{/* Storage/tracking restrictions leave the product usable. */}
}
