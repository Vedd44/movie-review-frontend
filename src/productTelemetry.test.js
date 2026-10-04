import {recordProductTelemetry,sanitizeTelemetryProperties,setAnalyticsAuthenticated} from './productTelemetry';
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
 telemetry.recordProductTelemetry('recommendation_requested',{authenticated:false});
 jest.advanceTimersByTime(10000);expect(global.fetch).not.toHaveBeenCalled();
 telemetry.recordProductTelemetry('page_viewed',{authenticated:true});
 jest.advanceTimersByTime(5000);expect(global.fetch).not.toHaveBeenCalled();
 telemetry.recordProductTelemetry('recommendation_returned',{outcome:'pick',latency_ms:9000});
 jest.advanceTimersByTime(5000);await Promise.resolve();expect(global.fetch).toHaveBeenCalledTimes(1);
 expect(JSON.parse(global.fetch.mock.calls[0][1].body).events).toHaveLength(3);
 telemetry.recordProductTelemetry('movie_saved',{movie_id:42});
 consent.setCookieChoice('rejected');
 jest.advanceTimersByTime(10000);await Promise.resolve();
 expect(global.fetch).toHaveBeenCalledTimes(1);
 expect(window.sessionStorage.getItem('reelbot:metrics-session')).toBeNull();
 window.localStorage.clear();jest.clearAllTimers();jest.useRealTimers();process.env.NODE_ENV=previous;Object.defineProperty(window,'crypto',{configurable:true,value:old});
});
