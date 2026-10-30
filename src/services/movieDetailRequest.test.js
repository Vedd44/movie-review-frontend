import axios from 'axios';
import { requestMovieDetails } from './movieDetailRequest';
jest.mock('axios');
const limited = seconds => ({response:{status:429,data:{retry_after_seconds:seconds}}});
beforeEach(() => { jest.useFakeTimers(); jest.resetAllMocks(); });
afterEach(() => { jest.useRealTimers(); });
const flush = async () => { for(let i=0;i<10;i++) await Promise.resolve(); };
const advance = async ms => { await flush(); jest.advanceTimersByTime(ms); await flush(); };

test.each([1,2,3])('first uncached read waits %s seconds then succeeds without refresh', async seconds => {
 const response={data:{id:123}};
 axios.get.mockRejectedValueOnce(limited(seconds)).mockResolvedValueOnce(response);
 const controller=new AbortController();
 const request=requestMovieDetails('/movies/new',{signal:controller.signal});
 await advance(seconds*1000-1); expect(axios.get).toHaveBeenCalledTimes(1);
 await advance(1); expect(await request).toBe(response);
 expect(axios.get).toHaveBeenCalledTimes(2);
 expect(axios.get).toHaveBeenLastCalledWith('/movies/new',{signal:expect.anything(),timeout:15000});
});
test('warm read returns immediately with one request',async()=>{
 axios.get.mockResolvedValue({data:{id:1}}); await requestMovieDetails('/movies/warm');
 expect(axios.get).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});
test.each([limited(4),limited(60),limited(undefined),limited(0),limited(-1),limited('1'),{response:{status:404}},{response:{status:503}},new Error('Network Error')])('does not blindly retry %j',async error=>{
 axios.get.mockRejectedValue(error); await expect(requestMovieDetails('/movies/new')).rejects.toBe(error);
 expect(axios.get).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});
test('persistent short throttling stops after two retries and at most six seconds waiting',async()=>{
 const error=limited(3); axios.get.mockRejectedValue(error);
 const result=requestMovieDetails('/movies/new').catch(e=>e);
 await advance(3000); await advance(3000); await advance(3000);
 expect(await result).toBe(error); expect(axios.get).toHaveBeenCalledTimes(3); expect(jest.getTimerCount()).toBe(0);
});
test('route change or unmount cancels pending timer and makes no old-route retry',async()=>{
 axios.get.mockRejectedValue(limited(1)); const controller=new AbortController();
 const result=requestMovieDetails('/movies/old',{signal:controller.signal}).catch(e=>e);
 await advance(0); controller.abort(); await advance(5000);
 expect((await result).name).toBe('AbortError'); expect(axios.get).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});
test('already cancelled route never starts a request',async()=>{
 const controller=new AbortController(); controller.abort();
 await expect(requestMovieDetails('/movies/old',{signal:controller.signal})).rejects.toHaveProperty('name','AbortError');
 expect(axios.get).not.toHaveBeenCalled();
});
test('a failure after admission remains a failure, not another retry',async()=>{
 const error={response:{status:503}};axios.get.mockRejectedValueOnce(limited(1)).mockRejectedValueOnce(error);
 const result=requestMovieDetails('/movies/new').catch(e=>e);await advance(1000);
 expect(await result).toBe(error);expect(axios.get).toHaveBeenCalledTimes(2);
});

test('a transport timeout is bounded and never automatically retried',async()=>{
 const error=Object.assign(new Error('timeout of 15000ms exceeded'),{code:'ECONNABORTED'});
 axios.get.mockRejectedValue(error);
 await expect(requestMovieDetails('/movies/stalled')).rejects.toBe(error);
 expect(axios.get).toHaveBeenCalledWith('/movies/stalled',{signal:expect.anything(),timeout:15000});
 expect(axios.get).toHaveBeenCalledTimes(1);
 expect(jest.getTimerCount()).toBe(0);
});

test('whole operation deadline rejects even a nonresponsive adapter and aborts its signal',async()=>{
 let lateResolve;axios.get.mockImplementation(()=>new Promise(resolve=>{lateResolve=resolve;}));
 const result=requestMovieDetails('/movies/stalled').catch(e=>e);await advance(14999);
 expect(axios.get.mock.calls[0][1].signal.aborted).toBe(false);
 await advance(1);expect(await result).toHaveProperty('code','ECONNABORTED');
 expect(axios.get.mock.calls[0][1].signal.aborted).toBe(true);
 expect(axios.get).toHaveBeenCalledTimes(1);expect(jest.getTimerCount()).toBe(0);
 lateResolve({data:{id:1}});await flush();expect(await result).toHaveProperty('code','ECONNABORTED');
});
test('delayed short429 retries share one deadline, not three transport deadlines',async()=>{
 axios.get.mockImplementation(()=>new Promise((resolve,reject)=>setTimeout(()=>reject(limited(3)),10000)));
 const result=requestMovieDetails('/movies/slow-admission').catch(e=>e);
 await advance(10000);expect(axios.get).toHaveBeenCalledTimes(1);
 await advance(3000);expect(axios.get).toHaveBeenCalledTimes(2);
 await advance(2000);expect(await result).toHaveProperty('code','ECONNABORTED');
 expect(axios.get.mock.calls[1][1].signal.aborted).toBe(true);
 await advance(10000);expect(axios.get).toHaveBeenCalledTimes(2);
});
test('caller cancellation settles even a nonresponsive adapter and removes deadline work',async()=>{
 axios.get.mockImplementation(()=>new Promise(()=>{}));const controller=new AbortController();
 const result=requestMovieDetails('/movies/stalled',{signal:controller.signal}).catch(e=>e);
 await advance(0);controller.abort();expect(await result).toHaveProperty('name','AbortError');
 expect(axios.get.mock.calls[0][1].signal.aborted).toBe(true);expect(jest.getTimerCount()).toBe(0);
});
