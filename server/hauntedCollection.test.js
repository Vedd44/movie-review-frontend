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
const expected = ['the-others-2001','the-haunting-1963','the-innocents-1961','the-changeling-1980','the-devil-s-backbone-2001','poltergeist-1982','the-conjuring-2013','the-amityville-horror-1979'];
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
test('eight verified films complete a distinct collection without duplicate memberships', () => {
  assert.equal(collections.length,41);
  assert.ok(c);
  assert.deepEqual(Array.from(c.movies),expected);
  assert.equal(new Set(c.movies).size,8);
  assert.deepEqual(Array.from(c.categories),['Seasonal','Genre']);
  assert.deepEqual(c.movies.map(s=>movies[s].id).join(','),'1933,11772,16372,13550,1433,609,138843,11449');
  assert.deepEqual(Array.from(c.movies.filter(s=>collections.some(other=>other!==c && other.movies.includes(s)))),['the-others-2001','the-conjuring-2013']);
  for(const s of expected){assert.equal(movies[s].canonical_slug,s);assert.equal(previews[s].id,movies[s].id);assert.equal(previews[s].poster_path,movies[s].poster_path);}
  assert.equal(c.movieNotes,undefined);
  assert.ok(c.description.length < 180);
  assert.match(c.description,/\.$/);
  assert.equal(c.title,'Best Haunted House Movies');
  assert.equal(c.contentNote,undefined);
});
test('crawlable description, no warning, standard cards, ordered schema, canonical and sitemap agree',async()=>{
  const data=await getPageData('/collections/'+slug,new URLSearchParams(),{collections,movies,fetcher:()=>{throw Error('No network expected');}});
  assert.equal(data.heading,c.title);
  assert.equal(data.description,c.description);
  assert.equal(data.title,c.title+' | ReelBot Collections');
  assert.equal(data.image,'https://reelbot.movie/social/collections/'+slug+'-v6.jpg');
  assert.ok(!data.content.includes('Content guidance'));
  assert.ok(!data.content.includes('These films can be intensely frightening'));
  assert.equal(data.schema[1].itemListElement.length,8);
  for(const [i,s] of expected.entries()){
    assert.equal(data.schema[1].itemListElement[i].position,i+1);
    assert.equal(data.schema[1].itemListElement[i].url,'https://reelbot.movie/movies/'+s);
    assert.equal(data.schema[1].itemListElement[i].description,undefined);
  }
  const html=renderPage('<html><head></head><body><div id="root"></div></body></html>',data);
  assert.ok(html.includes('rel="canonical" href="https://reelbot.movie/collections/'+slug+'"'));
  assert.equal((html.match(/<h1>/g)||[]).length,1);
  assert.ok(buildSitemap(['/collections/'+slug]).includes('/collections/'+slug));
});

test('new additions have matching verified catalog identities and artwork',()=>{
  for (const [slug,id,year,director] of [
    ['poltergeist-1982',609,1982,'Tobe Hooper'],
    ['the-conjuring-2013',138843,2013,'James Wan'],
    ['the-amityville-horror-1979',11449,1979,'Stuart Rosenberg'],
  ]) {
    assert.equal(movies[slug].id,id);
    assert.equal(movies[slug].release_year,year);
    assert.equal(movies[slug].director_credit.name,director);
    assert.ok(movies[slug].runtime > 0);
    assert.match(movies[slug].poster_path,/^\/[A-Za-z0-9]+\.jpg$/);
  }
});
