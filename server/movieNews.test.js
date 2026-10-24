const test = require('node:test');
const assert = require('node:assert/strict');
const {publicSnapshot, createHandler} = require('../api/movie-news');
const {safeUrl,isFreshStory,isStale} = require('../src/news/policy');
const story = {id:'1',headline:'Original headline',summary:'Original description',take:'Separate opinion',sourceName:'Variety',sourceUrl:'https://variety.com/2026/film/news/example/',publishedAt:new Date().toISOString(),secret:'never public'};
test('public snapshot preserves source text and strips internal data',()=>{const out=publicSnapshot({version:1,updatedAt:new Date().toISOString(),items:[story]}); assert.equal(out.items[0].summary,story.summary); assert.equal(out.items[0].secret,undefined);});
test('public snapshot caps25 and rejects synthetic or untrusted URLs',()=>{assert.equal(publicSnapshot({version:1,items:Array.from({length:30},()=>story)}).items.length,25); assert.equal(publicSnapshot({version:1,items:[{...story,synthetic:true},{...story,sourceUrl:'https://evil.com'}]}).items.length,0);});
test('source URLs reject credentials and hostile protocols',()=>{assert.equal(safeUrl('https://user:pass@variety.com/'),false); assert.equal(safeUrl('javascript:alert(1)'),false); assert.equal(safeUrl(story.sourceUrl),true);});
test('freshness is bounded and missing snapshot stale',()=>{assert.equal(isFreshStory(story),true); assert.equal(isFreshStory({...story,publishedAt:'2020-01-01'}),false); assert.equal(isStale({}),true);});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;},end(){return this;}};}
test('upstream failure is503 not empty programme',async()=>{const res=response();await createHandler(async()=>({ok:false}))({method:'GET'},res);assert.equal(res.code,503);assert.equal(res.body.items,undefined);});
test('post forbidden without upstream request',async()=>{const res=response();await createHandler(()=>{throw Error('should not call');})({method:'POST'},res);assert.equal(res.code,405);});
test('head validates upstream without body',async()=>{const res=response();await createHandler(async()=>({ok:true,json:async()=>({version:1,items:[story]})}))({method:'HEAD'},res);assert.equal(res.code,200);assert.equal(res.body,undefined);});
const {createWakeHandler}=require('../api/movie-news-wake');
test('scheduled wake only reads fixed backend and cannot force refresh',async()=>{let called;const res=response();await createWakeHandler(async(url,options)=>{called={url,options};return{status:503};})({method:'GET',query:{force:'true'}},res);assert.equal(res.code,200);assert.equal(res.body.snapshotReady,false);assert.equal(called.url,'https://movie-review-backend-zevb.onrender.com/movie-news');assert.equal(called.options.method,undefined);});
test('wake rejects POST',async()=>{const res=response();await createWakeHandler(()=>{throw Error('not reached');})({method:'POST'},res);assert.equal(res.code,405);});
test('cron is six-hour UTC schedule on existing project',()=>{const config=require('../vercel.json');assert.deepEqual(config.crons,[{path:'/api/movie-news-wake',schedule:'0 */6 * * *'}]);});
