import { act, renderHook, waitFor } from '@testing-library/react';
import useMovieNews from './useMovieNews';
const snapshot={version:1,updatedAt:new Date().toISOString(),items:[]};
afterEach(()=>{jest.useRealTimers();delete global.fetch;});
test('fetches only the public news endpoint without credentials', async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>snapshot});
 const {result}=renderHook(()=>useMovieNews());
 await waitFor(()=>expect(result.current.status).toBe('ready'));
 expect(global.fetch).toHaveBeenCalledWith('/api/movie-news',expect.objectContaining({credentials:'omit',signal:expect.anything()}));
});
test('retry recovers a failed request and unmount aborts in-flight work', async()=>{
 global.fetch=jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ok:true,json:async()=>snapshot});
 const {result,unmount}=renderHook(()=>useMovieNews());
 await waitFor(()=>expect(result.current.status).toBe('error'));
 act(()=>result.current.retry()); await waitFor(()=>expect(result.current.status).toBe('ready'));
 const signal=global.fetch.mock.calls[1][1].signal; unmount(); expect(signal.aborted).toBe(true);
});
test('aborts slow requests after eight seconds and reports an error', async()=>{
 jest.useFakeTimers();
 global.fetch=jest.fn((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')))));
 const {result}=renderHook(()=>useMovieNews());
 await act(async()=>{jest.advanceTimersByTime(8000);});
 expect(result.current.status).toBe('error');
});
