import {mergeWatchAvailability} from './watchAvailability';
const provider=(id,name,extra={})=>({id,name,...extra});
const fallback={region:'US',subscription:[provider(9,'Amazon Prime Video',{logo_path:'/prime.jpg'}),provider(10,'Amazon Prime Video with Ads',{logo_path:'/primeads.jpg'}),provider(11,'Paramount+ Amazon Channel',{logo_path:'/paramount.jpg'}),provider(12,'Paramount Plus Premium',{logo_path:'/premium.jpg'})],rent:[provider(2,'Apple TV Store',{logo_path:'/apple.jpg'}),provider(3,'YouTube',{logo_path:'/youtube.jpg'})],buy:[],free:[]};
const direct={source:'watchmode',region:'US',subscription:[provider(26,'Prime Video',{direct_url:'https://watch.amazon.com/detail?gti=movie'}),provider(27,'Paramount+ (Via Amazon Prime)',{direct_url:'https://watch.amazon.com/detail?gti=movie'})],rent:[provider(30,'AppleTV',{direct_url:'https://tv.apple.com/movie/123'})],buy:[]};
test('shows direct offers only while reusing TMDB icons',()=>{
 const result=mergeWatchAvailability(fallback,direct);
 expect(result.subscription).toHaveLength(2);expect(result.subscription[0].logo_path).toBe('/prime.jpg');expect(result.subscription[1].logo_path).toBe('/paramount.jpg');
 expect(result.subscription.some(p=>p.name==='Amazon Prime Video with Ads')).toBe(false);
 expect(result.rent).toHaveLength(1);expect(result.rent[0].logo_path).toBe('/apple.jpg');
 expect(result.rent[0].destination).toBe('provider');
 expect(mergeWatchAvailability(fallback,null).subscription).toEqual([]);
});
test('different countries never merge; logo matching cannot change a direct destination',()=>{
 const result=mergeWatchAvailability({...fallback,region:'GB'},direct);expect(result.subscription).toHaveLength(2);expect(result.subscription[0].logo_path).toBeNull();
 expect(result.subscription[0].direct_url).toBe(direct.subscription[0].direct_url);
});
test('filters failed direct destinations even from a cached response',()=>{
 const result=mergeWatchAvailability(fallback,{...direct,free:[
 provider(391,'Pluto TV',{direct_url:'https://pluto.tv/us/search/details/movies/69bc51890aa5b14facb51163'}),
 provider(345,'YouTube',{direct_url:'https://www.youtube.com/watch?v=SHoh9cb9fT8'}),
 provider(296,'Tubi TV',{direct_url:'https://tubitv.com/movies/100053674'})],rent:[provider(30,'AppleTV',{direct_url:'javascript:alert(1)'})]});
 expect(result.free.map(p=>p.name)).toEqual(['Tubi TV']);expect(result.rent).toEqual([]);
});
