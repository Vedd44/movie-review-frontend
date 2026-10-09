import {recordProductTelemetry,sanitizeTelemetryProperties,setAnalyticsAuthenticated} from './productTelemetry';
jest.mock('./lib/supabaseClient',()=>({getSupabaseClient:jest.fn().mockResolvedValue({auth:{getSession:jest.fn().mockResolvedValue({data:{session:null}})}})}));
test('guest telemetry keeps coarse properties and excludes private request text and account details',()=>{
 setAnalyticsAuthenticated(false);expect(sanitizeTelemetryProperties({prompt:'My private request',email:'private',user_id:'private',movie_id:42,latency_ms:3000,request_type:'initial'})).toEqual({movie_id:42,latency_ms:3000,request_type:'initial',authenticated:false,page:'home'});
 setAnalyticsAuthenticated(true);expect(sanitizeTelemetryProperties({authenticated:false}).authenticated).toBe(false);
});
test('telemetry never runs in test/dev environments',()=>{global.fetch=jest.fn();const spy=global.fetch;recordProductTelemetry('recommendation_requested',{prompt:'private'});expect(spy).not.toHaveBeenCalled();});

test('production batching makes no network request while a first pick is pending',async()=>{
 jest.resetModules();jest.useFakeTimers();const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
 const old=window.crypto;let number=0;Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=>`00000000-0000-4000-8000-${String(++number).padStart(12,'0')}`}});
 global.fetch=jest.fn().mockResolvedValue({ok:true});
 const consent=require('./cookieConsent');
 const telemetry=require('./productTelemetry');
 telemetry.recordProductTelemetry('page_viewed');
 expect(window.sessionStorage.getItem('reelbot:metrics-session')).toBeNull();
 consent.setCookieChoice('accepted');
 const finishRequest=telemetry.deferProductTelemetry();
 telemetry.recordProductTelemetry('recommendation_requested',{authenticated:false});
 jest.advanceTimersByTime(10000);expect(global.fetch).not.toHaveBeenCalled();
 telemetry.recordProductTelemetry('page_viewed',{authenticated:true});
 jest.advanceTimersByTime(5000);expect(global.fetch).not.toHaveBeenCalled();
 telemetry.recordProductTelemetry('recommendation_returned',{outcome:'pick',latency_ms:9000});
 finishRequest();
 jest.advanceTimersByTime(5000);for(let i=0;i<20;i++)await Promise.resolve();expect(global.fetch).toHaveBeenCalledTimes(1);
 expect(JSON.parse(global.fetch.mock.calls[0][1].body).events).toHaveLength(3);
 telemetry.recordRequestActivity({prompt:'Contact me at user@example.com',result_text:'A private recommendation',request_id:telemetry.createActivityRequestId(),kind:'answer'});
 jest.advanceTimersByTime(5000);for(let i=0;i<20;i++)await Promise.resolve();
 const details=JSON.parse(global.fetch.mock.calls[1][1].body).events[0];
 expect(details.name).toBe('request_logged');expect(details.properties.prompt).not.toContain('user@example.com');
 expect(details.properties.result_text).toBe('A private recommendation');
 telemetry.recordProductTelemetry('movie_saved',{movie_id:42});
 consent.setCookieChoice('rejected');
 jest.advanceTimersByTime(10000);await Promise.resolve();
 expect(global.fetch).toHaveBeenCalledTimes(2);
 expect(window.sessionStorage.getItem('reelbot:metrics-session')).toBeNull();
 window.localStorage.clear();jest.clearAllTimers();jest.useRealTimers();process.env.NODE_ENV=previous;Object.defineProperty(window,'crypto',{configurable:true,value:old});
});


describe('production telemetry delivery lifecycle',()=>{
 let telemetry,consent,previous,oldCrypto;
 const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
 const tick=async()=>{jest.advanceTimersByTime(5000);await settle();};
 beforeEach(()=>{
  jest.resetModules();jest.useFakeTimers();window.localStorage.clear();window.sessionStorage.clear();
  previous=process.env.NODE_ENV;process.env.NODE_ENV='production';oldCrypto=window.crypto;
  let number=0;Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=>`00000000-0000-4000-8000-${String(++number).padStart(12,'0')}`}});
  global.fetch=jest.fn().mockResolvedValue({ok:true,status:202});
  consent=require('./cookieConsent');telemetry=require('./productTelemetry');consent.setCookieChoice('accepted');
 });
 afterEach(()=>{
  consent.setCookieChoice('rejected');jest.clearAllTimers();jest.useRealTimers();process.env.NODE_ENV=previous;
  Object.defineProperty(window,'crypto',{configurable:true,value:oldCrypto});window.localStorage.clear();window.sessionStorage.clear();
 });
 test('aborting a request releases queued browsing without recording a fake outcome',async()=>{
  const controller=new AbortController();const finish=telemetry.deferProductTelemetry(controller.signal);
  telemetry.recordProductTelemetry('ask_reelbot_submitted');await tick();expect(fetch).not.toHaveBeenCalled();
  controller.abort();finish();telemetry.recordProductTelemetry('page_viewed',{page:'browse'});await tick();
  expect(JSON.parse(fetch.mock.calls[0][1].body).events.map(e=>e.name)).toEqual(['ask_reelbot_submitted','page_viewed']);
 });
 test('one completion or cancellation cannot release another overlapping request',async()=>{
  const first=new AbortController(),second=new AbortController();
  const finishFirst=telemetry.deferProductTelemetry(first.signal),finishSecond=telemetry.deferProductTelemetry(second.signal);
  telemetry.recordProductTelemetry('recommendation_requested');telemetry.recordProductTelemetry('ask_reelbot_submitted');
  first.abort();finishFirst();telemetry.recordProductTelemetry('recommendation_returned');await tick();expect(fetch).not.toHaveBeenCalled();
  finishSecond();finishSecond();await tick();expect(fetch).toHaveBeenCalledTimes(1);
 });
 test.each([503,429,408,'network'])('retries transient %s with identical batch and event IDs',async status=>{
  if(status==='network')fetch.mockRejectedValueOnce(new Error('offline'));else fetch.mockResolvedValueOnce({ok:false,status});
  telemetry.recordProductTelemetry('page_viewed');await tick();telemetry.recordProductTelemetry('movie_saved',{movie_id:42});await tick();
  expect(fetch).toHaveBeenCalledTimes(2);expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
  await tick();expect(JSON.parse(fetch.mock.calls[2][1].body).events[0].name).toBe('movie_saved');
 });
 test('drops permanent failures and bounds transient retry to three attempts',async()=>{
  fetch.mockResolvedValueOnce({ok:false,status:400});telemetry.recordProductTelemetry('page_viewed');await tick();await tick();expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockResolvedValue({ok:false,status:503});telemetry.recordProductTelemetry('movie_saved');
  await tick();await tick();await tick();await tick();expect(fetch).toHaveBeenCalledTimes(4);
 });
 test('withdrawal discards queued and retry batches across later acceptance',async()=>{
  fetch.mockResolvedValueOnce({ok:false,status:503});telemetry.recordProductTelemetry('page_viewed');await tick();
  telemetry.recordProductTelemetry('movie_saved');consent.setCookieChoice('rejected');consent.setCookieChoice('accepted');await tick();expect(fetch).toHaveBeenCalledTimes(1);
  telemetry.recordProductTelemetry('page_viewed',{page:'browse'});await tick();
  expect(JSON.parse(fetch.mock.calls[1][1].body).events).toHaveLength(1);
  expect(JSON.parse(fetch.mock.calls[1][1].body).session_id).not.toBe(JSON.parse(fetch.mock.calls[0][1].body).session_id);
 });
 test('late failure after withdrawal and acceptance cannot resurrect the old batch',async()=>{
  let reject;fetch.mockImplementationOnce(()=>new Promise((resolve,rejectPromise)=>{reject=rejectPromise;}));
  telemetry.recordProductTelemetry('page_viewed');await tick();const signal=fetch.mock.calls[0][1].signal;
  consent.setCookieChoice('rejected');expect(signal.aborted).toBe(true);consent.setCookieChoice('accepted');
  telemetry.recordProductTelemetry('movie_saved',{movie_id:7});reject(new Error('aborted'));await settle();await tick();
  expect(fetch).toHaveBeenCalledTimes(2);expect(JSON.parse(fetch.mock.calls[1][1].body).events.map(e=>e.name)).toEqual(['movie_saved']);
 });
 test('withdrawal during authenticated session lookup prevents send',async()=>{
  let resolve;require('./lib/supabaseClient').getSupabaseClient.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  telemetry.recordProductTelemetry('page_viewed',{authenticated:true});await tick();
  consent.setCookieChoice('rejected');consent.setCookieChoice('accepted');resolve({auth:{getSession:async()=>({data:{session:null}})}});await settle();await tick();expect(fetch).not.toHaveBeenCalled();
 });
 test('guest and signed-in events retain coarse state without adding identity fields',async()=>{
  telemetry.setAnalyticsAuthenticated(false);telemetry.recordProductTelemetry('page_viewed',{email:'private'});
  telemetry.setAnalyticsAuthenticated(true);telemetry.recordProductTelemetry('movie_saved',{movie_id:7,user_id:'private'});await tick();
  const events=JSON.parse(fetch.mock.calls[0][1].body).events;
  expect(events.map(e=>e.properties.authenticated)).toEqual([false,true]);expect(JSON.stringify(events)).not.toMatch(/private|user_id|email/);
 });
 test('withdrawal clears data but preserves independent active-request deferrals',async()=>{
  const first=new AbortController(),second=new AbortController();
  const finishFirst=telemetry.deferProductTelemetry(first.signal),finishSecond=telemetry.deferProductTelemetry(second.signal);
  telemetry.recordProductTelemetry('recommendation_requested');consent.setCookieChoice('rejected');consent.setCookieChoice('accepted');
  telemetry.recordProductTelemetry('page_viewed',{page:'browse'});first.abort();finishFirst();await tick();expect(fetch).not.toHaveBeenCalled();
  finishSecond();await tick();expect(JSON.parse(fetch.mock.calls[0][1].body).events.map(e=>e.name)).toEqual(['page_viewed']);
 });
 test('a timed-out transport retries without a stuck sending lock',async()=>{
  fetch.mockImplementationOnce((url,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('timeout')));}));
  telemetry.recordProductTelemetry('page_viewed');await tick();jest.advanceTimersByTime(10000);await settle();await tick();
  expect(fetch).toHaveBeenCalledTimes(2);expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
 });

 test('a stalled auth lookup times out and cannot block later guest delivery',async()=>{
  require('./lib/supabaseClient').getSupabaseClient.mockImplementationOnce(()=>new Promise(()=>{}));
  telemetry.recordProductTelemetry('page_viewed',{authenticated:true});await tick();
  jest.advanceTimersByTime(10000);await settle();
  consent.setCookieChoice('rejected');consent.setCookieChoice('accepted');telemetry.recordProductTelemetry('page_viewed',{authenticated:false});await tick();
  expect(fetch).toHaveBeenCalledTimes(1);expect(JSON.parse(fetch.mock.calls[0][1].body).events[0].properties.authenticated).toBe(false);
 });
 test('withdrawal interrupts a never-settling auth lookup without waiting for its timeout',async()=>{
  require('./lib/supabaseClient').getSupabaseClient.mockImplementationOnce(()=>new Promise(()=>{}));
  telemetry.recordProductTelemetry('page_viewed',{authenticated:true});await tick();
  consent.setCookieChoice('rejected');consent.setCookieChoice('accepted');telemetry.recordProductTelemetry('movie_saved',{authenticated:false});await settle();await tick();
  expect(fetch).toHaveBeenCalledTimes(1);expect(JSON.parse(fetch.mock.calls[0][1].body).events[0].name).toBe('movie_saved');
 });

 test('retry keeps its first auth context when another account signs in',async()=>{
  let token='account-a-test-token';const getSession=jest.fn(async()=>({data:{session:{access_token:token}}}));
  require('./lib/supabaseClient').getSupabaseClient.mockResolvedValueOnce({auth:{getSession}});
  fetch.mockResolvedValueOnce({ok:false,status:503});telemetry.recordProductTelemetry('movie_saved',{authenticated:true,movie_id:7});await tick();
  token='account-b-test-token';await tick();expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer account-a-test-token');
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer account-a-test-token');expect(getSession).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
 });

});

test('anonymous-to-account continuity is preserved, while logout and account changes rotate the visit',async()=>{
 jest.resetModules();jest.useFakeTimers();const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
 const old=window.crypto;let n=300;Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`}});
 global.fetch=jest.fn().mockResolvedValue({ok:true});const consent=require('./cookieConsent'),telemetry=require('./productTelemetry');consent.setCookieChoice('accepted');
 telemetry.recordProductTelemetry('page_viewed');const guest=window.sessionStorage.getItem('reelbot:metrics-session');
 telemetry.setAnalyticsIdentity('account-a');telemetry.recordProductTelemetry('login');expect(window.sessionStorage.getItem('reelbot:metrics-session')).toBe(guest);
 telemetry.setAnalyticsIdentity('');telemetry.recordProductTelemetry('page_viewed');const nextGuest=window.sessionStorage.getItem('reelbot:metrics-session');expect(nextGuest).not.toBe(guest);
 telemetry.setAnalyticsIdentity('account-b');telemetry.recordProductTelemetry('login');expect(window.sessionStorage.getItem('reelbot:metrics-session')).toBe(nextGuest);
 telemetry.setAnalyticsIdentity('account-c');telemetry.recordProductTelemetry('login');expect(window.sessionStorage.getItem('reelbot:metrics-session')).not.toBe(nextGuest);
 consent.setCookieChoice('rejected');window.localStorage.clear();window.sessionStorage.clear();jest.clearAllTimers();jest.useRealTimers();process.env.NODE_ENV=previous;Object.defineProperty(window,'crypto',{configurable:true,value:old});
});
