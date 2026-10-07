import {mergeWatchAvailability} from './watchAvailability';
const provider=(id,name,extra={})=>({id,name,...extra});
const fallback={region:'US',subscription:[provider(9,'Amazon Prime Video',{logo_path:'/prime.jpg'}),provider(10,'Amazon Prime Video with Ads',{logo_path:'/primeads.jpg'}),provider(11,'Paramount+ Amazon Channel',{logo_path:'/paramount.jpg'}),provider(12,'Paramount Plus Premium',{logo_path:'/premium.jpg'})],rent:[provider(2,'Apple TV Store',{logo_path:'/apple.jpg'}),provider(3,'YouTube',{logo_path:'/youtube.jpg'})],buy:[],free:[]};
const direct={source:'watchmode',region:'US',subscription:[provider(26,'Prime Video',{direct_url:'https://watch.amazon.com/detail?gti=movie'}),provider(27,'Paramount+ (Via Amazon Prime)',{direct_url:'https://watch.amazon.com/detail?gti=movie'})],rent:[provider(30,'AppleTV',{direct_url:'https://tv.apple.com/movie/123'})],buy:[]};
test('adds missing providers, reuses actual icons and retains separate subscription tiers',()=>{
 const result=mergeWatchAvailability(fallback,direct);
 expect(result.subscription).toHaveLength(4);expect(result.subscription[0].logo_path).toBe('/prime.jpg');expect(result.subscription[1].logo_path).toBe('/paramount.jpg');
 expect(result.subscription.find(p=>p.name==='Amazon Prime Video with Ads').destination).toBe('tmdb');
 expect(result.subscription.find(p=>p.name==='Paramount Plus Premium').destination).toBe('tmdb');
 expect(result.rent).toHaveLength(2);expect(result.rent[0].logo_path).toBe('/apple.jpg');expect(result.rent[1]).toMatchObject({name:'YouTube',source:'tmdb',destination:'tmdb'});
 expect(result.has_tmdb_options).toBe(true);
});
test('different countries never merge; logo matching cannot change a direct destination',()=>{
 const result=mergeWatchAvailability({...fallback,region:'GB'},direct);expect(result.subscription).toHaveLength(2);expect(result.has_tmdb_options).toBe(false);expect(result.subscription[0].logo_path).toBeNull();
 expect(result.subscription[0].direct_url).toBe(direct.subscription[0].direct_url);
});
test('unsafe direct offers cannot hide valid fallback options and identical storefront offers deduplicate',()=>{
 const result=mergeWatchAvailability(fallback,{...direct,rent:[provider(30,'AppleTV',{direct_url:'javascript:alert(1)'})]});expect(result.rent[0].destination).toBe('tmdb');
 expect(mergeWatchAvailability({...fallback,rent:[...fallback.rent,fallback.rent[1]]},null).rent).toHaveLength(2);
});
