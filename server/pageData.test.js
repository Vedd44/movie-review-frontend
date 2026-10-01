const test = require('node:test');
const assert = require('node:assert/strict');
const {getPageData,renderPage} = require('./pageData');
const movie = {id:157336,title:'Interstellar',canonical_slug:'interstellar-2014',release_year:2014,release_date:'2014-11-05',runtime:169,description:'A journey through space.',genre_names:['Science Fiction'],director:'Christopher Nolan'};
const response = (value,status=200)=>({ok:status===200,status,json:async()=>value});
const context = {fetcher:async()=>response(movie)};
test('numeric movie aliases permanently redirect to the canonical slug',async()=>{
  for(const route of ['/movie/157336','/movies/157336','/movies/157336/interstellar']) assert.equal((await getPageData(route,new URLSearchParams(),context)).redirect,'/movies/interstellar-2014');
});
test('movie HTML has unique canonical, social metadata, useful content and schema',async()=>{
  const data=await getPageData('/movies/interstellar-2014',new URLSearchParams(),context);
  const html=renderPage('<html><head><title>Home</title><link rel="canonical" href="https://reelbot.movie/"><meta property="og:title" content="Home"></head><body><div id="root"><section>Home</section></div></body></html>',data);
  assert.match(html, /Interstellar \(2014\)/);assert.match(html, /PT169M/);assert.match(html, /A journey through space/);
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1);assert.equal((html.match(/property="og:title"/g)||[]).length,1);
  assert.match(html, /href="https:\/\/reelbot.movie\/movies\/interstellar-2014"/);
});
test('404 and upstream failures cannot become an indexable homepage',async()=>{
  assert.equal((await getPageData('/unknown')).status,404);
  assert.equal((await getPageData('/collections/missing')).status,404);
  assert.equal((await getPageData('/movies/missing',new URLSearchParams(),{fetcher:async()=>response({},404)})).status,404);
  await assert.rejects(()=>getPageData('/movies/interstellar-2014',new URLSearchParams(),{fetcher:async()=>response({},503)}));
});
test('all collections and their films are crawlable, including beyond the first twelve',async()=>{
  const collections=Array.from({length:20},(_,i)=>({slug:`collection-${i}`,title:`Collection ${i}`,description:'Description',movies:['interstellar-2014']}));
  const index=await getPageData('/collections',new URLSearchParams(),{collections});
  assert.match(index.content,/\/collections\/collection-19/);
  const page=await getPageData('/collections/collection-19',new URLSearchParams(),{collections,movies:{'interstellar-2014':movie}});
  assert.match(page.content,/\/movies\/interstellar-2014/);
});
test('private, search and filtered pages are noindex while paginated browse is self canonical',async()=>{
  for(const path of ['/search','/account','/my-movies','/reset-password','/admin']) assert.equal((await getPageData(path)).robots,'noindex,follow');
  const feed={fetcher:async()=>response({results:[],total_pages:3})};
  assert.equal((await getPageData('/browse',new URLSearchParams('page=2'),feed)).path,'/browse?page=2');
  assert.equal((await getPageData('/browse',new URLSearchParams('genre=28'),feed)).robots,'noindex,follow');
});
test('untrusted movie strings cannot inject HTML or close JSON-LD scripts',()=>{
  const html=renderPage('<html><head></head><body><div id="root"></div></body></html>',{path:'/',title:'<script>x</script>',heading:'<img src=x>',description:'"quoted"',schema:[{name:'</script><script>bad</script>'}]});
  assert.ok(!html.includes('<script>bad'));assert.match(html,/&lt;img/);assert.match(html,/\\u003c\/script>/);
});
