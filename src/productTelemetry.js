import { hasAnalyticsConsent, subscribeCookieChoice } from './cookieConsent';
// Coarse, asynchronous product signals. Never send prompts, titles or account IDs.
const ALLOWED=new Set(['page_viewed','recommendation_requested','recommendation_returned','recommendation_failed','pick_presented','pick_chosen','pick_choice_removed','another_pick_clicked','refine_clicked','alternate_clicked','pick_details_clicked','movie_detail_opened','save_clicked','movie_saved','movie_unsaved','movie_watched','movie_unwatched','not_for_me_added','not_for_me_removed','pick_shared','watch_options_clicked','ask_reelbot_submitted','ask_reelbot_result','ask_reelbot_failed']);
let queue=[],timer=null,busy=false,sending=false,authenticated=false,sessionId='',initialized=false;
const uuid=()=>window.crypto?.randomUUID?.() || '';
export const telemetrySurface=path=>path==='/'?'home':path.startsWith('/p/')?'shared_pick':path.startsWith('/browse')?'browse':path.startsWith('/collections/')?'collection':path.startsWith('/movies/')||path.startsWith('/movie/')?'movie':path.startsWith('/people/')||path.startsWith('/person/')?'person':path==='/my-movies'?'my_movies':path==='/search'?'search':'other';
export const setAnalyticsAuthenticated=value=>{authenticated=Boolean(value);};
export function sanitizeTelemetryProperties(p={}) {
 const safe={};for(const key of ['movie_id','latency_ms','request_type','outcome','kind','prompt_category'])if(['string','number'].includes(typeof p[key]))safe[key]=p[key];
 safe.authenticated=typeof p.authenticated==='boolean'?p.authenticated:authenticated;
 safe.page=['home','browse','collection','movie','person','shared_pick','my_movies','search','ask'].includes(p.page)?p.page:telemetrySurface(window.location.pathname);
 return safe;
}
function schedule(){if(!timer)timer=setTimeout(()=>{timer=null;void flush();},5000);}
async function flush(force=false) {
 if(!hasAnalyticsConsent()){queue=[];busy=false;return;}
 if(!queue.length||sending||(busy&&!force)){if(queue.length)schedule();return;}
 const events=queue.splice(0,30);const body=JSON.stringify({session_id:sessionId,batch_id:uuid(),events});
 sending=true;
 try{await fetch('/api/product-events',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true});}catch{/* Metrics cannot interrupt choosing a movie. */}
 finally{sending=false;if(queue.length)schedule();}
}
export function recordProductTelemetry(name,p={}) {
 if(!hasAnalyticsConsent()||process.env.NODE_ENV!=='production'||typeof window==='undefined'||!ALLOWED.has(name)||window.location.pathname.startsWith('/admin'))return;
 try {
  if(!sessionId){sessionId=window.sessionStorage.getItem('reelbot:metrics-session')||uuid();if(!sessionId)return;window.sessionStorage.setItem('reelbot:metrics-session',sessionId);}
  if(!initialized){initialized=true;window.addEventListener('pagehide',()=>{void flush(true);});subscribeCookieChoice(()=>{if(!hasAnalyticsConsent()){queue=[];busy=false;sessionId='';if(timer)clearTimeout(timer);timer=null;try{window.sessionStorage.removeItem('reelbot:metrics-session');}catch{}}});}
  if(name==='recommendation_requested'||name==='ask_reelbot_submitted')busy=true;
  if(['recommendation_returned','recommendation_failed','ask_reelbot_result','ask_reelbot_failed'].includes(name))busy=false;
  queue.push({id:uuid(),name,time:Date.now(),properties:sanitizeTelemetryProperties(p)});if(queue.length>90)queue=queue.slice(-90);schedule();
 }catch{/* Storage/tracking restrictions leave the product usable. */}
}
