const test = require('node:test');
const assert = require('node:assert/strict');
const { readCollections } = require('./collections');
const { getPageData, renderPage } = require('./pageData');
const { buildSitemap } = require('./sitemap');
const movies = require('../src/generatedCollectionMovies.json');
const previews = require('../src/generatedCollectionPreviews.json');
const collections = readCollections();
const slug = 'haunted-house-ghost-stories';
const c = collections.find(c => c.slug === slug);
const expected = ['the-others-2001','the-haunting-1963','the-innocents-1961','the-changeling-1980','the-devil-s-backbone-2001'];
const fitsStrictRuntime = runtime => Number.isFinite(runtime) && runtime > 0 && runtime < 90;
test('strict under-90 collection excludes boundary and unknown runtimes', () => {
  for (const value of [90,91,0,-1,undefined,null,'89',NaN,Infinity]) assert.equal(fitsStrictRuntime(value),false);
  assert.equal(fitsStrictRuntime(89),true);
  const strict = collections.find(c=>c.slug==='best-movies-under-90-minutes');
  assert.equal(strict.movies.length,14);
  for (const s of strict.movies) assert.ok(fitsStrictRuntime(movies[s]?.runtime),s+' does not satisfy under 90');
  assert.ok(!strict.movies.includes('palm-springs-2020'));
  for(const s of ['great-90-minute-movies','best-date-night-movies']) assert.ok(collections.find(c=>c.slug===s).movies.includes('palm-springs-2020'));
});
test('five verified films add a distinct collection without duplicate memberships', () => {
  assert.equal(collections.length,41);
  assert.ok(c);
  assert.deepEqual(Array.from(c.movies),expected);
  assert.equal(new Set(c.movies).size,5);
  assert.deepEqual(Array.from(c.categories),['Seasonal','Genre']);
  assert.deepEqual(c.movies.map(s=>movies[s].id).join(','),'1933,11772,16372,13550,1433');
  assert.deepEqual(Array.from(c.movies.filter(s=>collections.some(other=>other!==c && other.movies.includes(s)))),['the-others-2001']);
  for(const s of expected){assert.ok(c.movieNotes[s]?.length>90);assert.equal(movies[s].canonical_slug,s);assert.equal(previews[s].id,movies[s].id);assert.equal(previews[s].poster_path,movies[s].poster_path);}
  assert.match(c.contentNote,/children/);
  assert.match(c.contentNote,/not a family-viewing/);
});
test('crawlable description, guidance, notes, ordered schema, canonical and sitemap agree',async()=>{
  const data=await getPageData('/collections/'+slug,new URLSearchParams(),{collections,movies,fetcher:()=>{throw Error('No network expected');}});
  assert.equal(data.heading,c.title);
  assert.equal(data.description,c.description);
  assert.equal(data.title,c.title+' | ReelBot Collections');
  assert.equal(data.schema[1].itemListElement.length,5);
  const esc=s=>s.replaceAll('&','&amp;').replaceAll("'",'&#39;');
  for(const [i,s] of expected.entries()){
    assert.equal(data.schema[1].itemListElement[i].position,i+1);
    assert.equal(data.schema[1].itemListElement[i].url,'https://reelbot.movie/movies/'+s);
    assert.ok(data.content.includes(esc(c.movieNotes[s])));
  }
  const html=renderPage('<html><head></head><body><div id="root"></div></body></html>',data);
  assert.ok(html.includes('rel="canonical" href="https://reelbot.movie/collections/'+slug+'"'));
  assert.equal((html.match(/<h1>/g)||[]).length,1);
  assert.ok(buildSitemap(['/collections/'+slug]).includes('/collections/'+slug));
});
