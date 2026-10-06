const test = require('node:test');
const assert = require('node:assert/strict');
const {getPageData,renderPage} = require('./pageData');
test('legal pages are public full-text documents without auth or backend requests', async () => {
  for (const path of ['/privacy', '/terms']) {
    const data = await getPageData(path, new URLSearchParams(), {fetcher: () => { throw new Error('Legal pages must not depend on the backend'); }});
    assert.equal(data.path, path);
    assert.ok(!data.privatePage);
    const html = renderPage('<html><head></head><body><div id="root"></div></body></html>', data);
    assert.match(html, /Updated [A-Za-z]+ \d{1,2}, \d{4}/);
    assert.match(html, /<section><h2>/);
    assert.match(html, /Feedback/);
    assert.match(html, new RegExp(`rel="canonical" href="https://reelbot.movie${path}"`));
    assert.ok(!html.includes('noindex'));
  }
});
test('homepage includes public policy links before JavaScript runs', async () => {
  const data = await getPageData('/', new URLSearchParams(), {fetcher: async () => response({results: []})});
  const html = renderPage('<html><head></head><body><div id="root"></div></body></html>', data);
  assert.match(html, /href="\/privacy">Privacy Policy/);
  assert.match(html, /href="\/terms">Terms of Service/);
});
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
test('home and how-it-works expose the same product explanation before hydration',async()=>{
  const copy=require('../src/productCopy');
  let calls=0;
  const home=await getPageData('/',new URLSearchParams(),{fetcher:async()=>{calls++;return response({results:[]});}});
  assert.equal(home.title,copy.title);assert.equal(home.description,copy.description);
  assert.match(home.content,/Get a movie recommendation/);assert.equal(calls,1);
  assert.deepEqual(home.schema.map(s=>s['@type']),['Organization','WebSite','WebApplication']);
  const how=await getPageData('/how-reelbot-works',new URLSearchParams(),{fetcher:()=>{throw new Error('Must not fetch');}});
  assert.match(how.content,/Is ReelBot an AI movie picker/);assert.match(how.content,/Your current request comes first/);
  assert.ok(!how.content.includes('remember'));
});
test('shared choice URLs are not indexed and do not cause recommendation or detail requests on server',async()=>{
  const page=await getPageData('/movie-night',new URLSearchParams('movies=1,2,3&choice=2'),{fetcher:()=>{throw new Error('Must not fetch');}});
  assert.equal(page.robots,'noindex,follow');
});
test('HTML uses slim metadata with cast links and upstream retry semantics',async()=>{
let endpoint;const data=await getPageData('/movies/interstellar-2014',new URLSearchParams(),{fetcher:async url=>{endpoint=url;return response({...movie,top_cast_credits:[{name:'Matthew McConaughey',canonical_path:'/person/10297'}]});}});assert.match(endpoint,/view=metadata$/);assert.match(data.content,/href="\/person\/10297"/);
await assert.rejects(()=>getPageData('/movies/interstellar-2014',new URLSearchParams(),{fetcher:async()=>({ok:false,status:429,headers:{get:()=> '6'}})}),error=>error.status===429&&error.retryAfter==='6');
});

test('person page documents use the metadata budget while preserving filmography',async()=>{
 let endpoint;
 const data=await getPageData('/people/christopher-nolan',new URLSearchParams(),{fetcher:async url=>{endpoint=url;return response({id:525,name:'Christopher Nolan',canonical_slug:'christopher-nolan',biography:'Director',movie_credits:[{id:272,title:'Batman Begins',canonical_slug:'batman-begins-2005'}]});}});
 assert.match(endpoint,/\/people\/resolve\/christopher-nolan\?view=metadata$/);
 assert.match(data.content,/Batman Begins/);assert.equal(data.robots,undefined);
});

test('public title templates stay compact for long movies, people and collections',async()=>{
 const {movieTitle,personTitle,collectionTitle}=require('../src/seoTitles');
 const manifest=require('../src/generatedCollectionMovies.json');
 for(const m of Object.values(manifest)) assert.ok(movieTitle(m.title,m.release_year || m.release_date?.slice(0,4)).length<=60,m.title);
 for(const c of require('./collections').readCollections()) assert.ok(collectionTitle(c.title).length<=60,c.title);
 assert.ok(personTitle('An Extremely Long Person Name That Exceeds The Normal Search Title Space').length<=60);
 const longMovie={...movie,title:'The Assassination of Jesse James by the Coward Robert Ford',canonical_slug:'long-film-2007',release_year:2007};
 const data=await getPageData('/movies/long-film-2007',new URLSearchParams(),{fetcher:async()=>response(longMovie)});
 assert.equal(data.title,movieTitle(longMovie.title,2007));assert.equal(data.heading,longMovie.title);assert.ok(data.title.length<=60);
});

test('known collection slugs use verified IDs instead of repeating title search',async()=>{
 const catalog=require('../src/generatedCollectionMovies.json');let requested;
 const film=catalog['dial-code-santa-claus-1990'];
 const page=await getPageData('/movies/dial-code-santa-claus-1990',new URLSearchParams(),{movies:catalog,fetcher:async url=>{requested=url;return response(film);}});
 assert.match(requested,/\/movies\/46959\?view=metadata$/);assert.equal(page.heading,'Dial Code Santa Claus');
});
