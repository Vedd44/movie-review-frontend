const test=require('node:test');const assert=require('node:assert/strict');
const {parseSharedPick,sharedPickQuery}=require('../src/sharedPick');
const {getPageData,renderPage}=require('./pageData');
const movie={id:671,title:'Harry Potter and the Philosopher’s Stone',canonical_slug:'harry-potter-2001',poster_path:'/poster.jpg'};
test('shared snapshots validate IDs, versions, corrupt links and bounded copy',()=>{
 assert.equal(parseSharedPick('?pick=broken'),null);
 assert.equal(parseSharedPick('?'+sharedPickQuery(movie,'Good','Brief'),672),null);
 assert.equal(parseSharedPick('?pick='+encodeURIComponent(JSON.stringify({v:2,id:671}))),null);
 assert.equal(parseSharedPick('?'+sharedPickQuery(movie,'x'.repeat(2000),'y'.repeat(1000))).why.length,1200);
});
test('shared movie has server-rendered metadata and escaped personal context; normal page remains normal',async()=>{
 const options={fetcher:async()=>({ok:true,status:200,json:async()=>movie})};
 const query=new URLSearchParams(sharedPickQuery(movie,'Warm adventure','<script>alert(1)</script>'));
 const data=await getPageData('/movies/harry-potter-2001',query,options);
 assert.match(data.title,/ReelBot’s pick:/);assert.match(data.image,/pick-image\?movie=671/);
 assert.equal(data.privatePage,true);assert.equal(data.robots,'noindex,follow');
 assert.match(data.content,/&lt;script&gt;/);assert.doesNotMatch(data.content,/<script>/);
 const html=renderPage('<html><head></head><body><div id="root"></div></body></html>',data);
 assert.match(html,/og:image/);assert.match(html,/twitter:card/);assert.match(html,/Why this fits/);
 const normal=await getPageData('/movies/harry-potter-2001',new URLSearchParams(),options);
 assert.doesNotMatch(normal.title,/ReelBot’s pick/);assert.notEqual(normal.privatePage,true);
});
test('preview contains true movie title with safe wrapping for long titles',()=>{
 const {titleLines}=require('../api/pick-image');
 const lines=titleLines(movie.title);assert.ok(lines.length<=5);assert.ok(lines.length>1);
});
test('short share URLs render movie metadata and saved context without a query string',async()=>{
 const snapshot={v:1,id:671,why:'A warm adventure',brief:'Something magical'};let calls=[];
 const data=await getPageData('/p/Abcdef123456',new URLSearchParams(),{fetcher:async url=>{calls.push(url);return {ok:true,status:200,json:async()=>url.includes('/reelbot/shares/') ? snapshot : movie};}});
 assert.equal(data.path,'/p/Abcdef123456');assert.match(data.title,/ReelBot’s pick/);assert.match(data.content,/The request/);assert.match(data.content,/Why ReelBot chose it/);assert.equal(calls.length,2);
 const missing=await getPageData('/p/bad',new URLSearchParams());assert.equal(missing.status,404);
});
