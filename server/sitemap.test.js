const test=require('node:test');
const assert=require('node:assert/strict');
const {buildSitemap,discoveryPaths,fetchDiscoveryPaths,canonicalPath}=require('./sitemap');
test('main sitemap lists unique canonical pages directly, including entry routes',()=>{
 const xml=buildSitemap(['/movies/heat-1995','https://reelbot.movie/movies/heat-1995','/people/christopher-nolan','/admin','/p/private','https://example.com/movies/heat-1995']);
 assert.match(xml,/<urlset xmlns=/);assert.doesNotMatch(xml,/<sitemapindex|<sitemap>/);
 assert.equal((xml.match(/\/movies\/heat-1995/g)||[]).length,1);
 assert.match(xml,/<loc>https:\/\/reelbot.movie\/<\/loc>/);
 assert.doesNotMatch(xml,/example.com|\/admin|\/p\/private/);
 assert.equal(canonicalPath('/movies/heat-1995?private=data'),null);
 assert.equal(canonicalPath('/people/sean-baker--1aqwn'),'/people/sean-baker--1aqwn');
});
test('discovery refresh preserves only valid canonical routes and rejects error documents',()=>{
 assert.deepEqual(discoveryPaths('<urlset><url><loc>https://reelbot.movie/people/christopher-nolan</loc></url><url><loc>https://other.com/people/no</loc></url></urlset>'),['/people/christopher-nolan']);
 assert.throws(()=>discoveryPaths('<html>Unavailable</html>'));
});
test('backend failure cannot prevent publishing the saved discovery sitemap',async()=>{
 const fresh=await fetchDiscoveryPaths(async()=>({ok:false,status:503}));
 const xml=buildSitemap(['/movies/heat-1995',...fresh]);
 assert.match(xml,/\/movies\/heat-1995/);
 const config=require('../vercel.json');
 assert.ok(!config.rewrites.some(r=>r.source==='/sitemap-discovery.xml'));
 for(const source of ['/sitemap.xml','/sitemap-curated.xml','/sitemap-discovery.xml'])assert.ok(config.headers.some(h=>h.source===source && h.headers.some(value=>value.key==='Content-Type'&&value.value.startsWith('application/xml'))));
});
