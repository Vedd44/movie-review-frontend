const test = require('node:test');
const assert = require('node:assert/strict');
const { readCollections } = require('./collections');
const { collectionMovieNote, collectionItemList } = require('../src/collectionEditorial');
const { getPageData, renderPage } = require('./pageData');
const { buildSitemap } = require('./sitemap');
const collections = readCollections();
const animation = collections.find(c => c.slug === 'animated-movies-for-adults');
test('adult animation adds eight ordered picks, seven new to the existing 39 collections', () => {
  assert.equal(collections.filter(c => c.slug !== "haunted-house-ghost-stories").length, 40);
  assert.equal(animation.movies.length, 8);
  assert.equal(new Set(animation.movies).size, 8);
  assert.deepEqual(Array.from(animation.movies.filter(slug => collections.filter(c => c !== animation).some(c => c.movies.includes(slug)))), ['perfect-blue-1998']);
  assert.equal(Object.keys(animation.movieNotes).length, 8);
  assert.match(animation.contentNote, /sexual violence/);
});
test('optional notes stay collection-scoped and do not mutate movies', () => {
  const movie = {title: 'Test', canonical_slug:'test-2000'};
  const c = {movieNotes:{'test-2000':'Only here'}};
  assert.equal(collectionMovieNote(c,movie),'Only here');
  assert.equal(collectionMovieNote({},movie),'');
  assert.equal(movie.description, undefined);
  assert.equal(collectionItemList({},[movie],'https://reelbot.movie').itemListElement[0].description,undefined);
});
test('client shared schema, crawlable notes, metadata and sitemap use the same collection', async () => {
  const movies = require('../src/generatedCollectionMovies.json');
  const data = await getPageData('/collections/'+animation.slug,new URLSearchParams(),{collections,movies});
  const entries = animation.movies.map(slug => movies[slug]);
  assert.ok(entries.every(Boolean), 'Every film must have a generated metadata entry');
  assert.deepEqual(data.schema[1],collectionItemList(animation, entries,'https://reelbot.movie'));
  assert.equal(data.schema[1].itemListElement.length, 8);
  assert.equal(data.title,'Animated Movies for Adults | ReelBot Collections');
  assert.match(data.image,/animated-movies-for-adults-v5.jpg$/);
  for (const note of Object.values(animation.movieNotes)) assert.ok(data.content.includes(note.replaceAll('&','&amp;').replaceAll("'",'&#39;')));
  assert.ok(buildSitemap(['/collections/'+animation.slug]).includes('/collections/animated-movies-for-adults'));
});
test('HTML and embedded schema escape optional editorial text', async () => {
  const unsafe = '</script><img src=x onerror=alert(1)>&"';
  const c = {slug:'test',title:'Test',description:'Test',movies:['test-2000'],contentNote:unsafe,movieNotes:{'test-2000':unsafe}};
  const data = await getPageData('/collections/test',new URLSearchParams(),{collections:[c],movies:{'test-2000':{title:'Test',canonical_slug:'test-2000'}}});
  const html = renderPage('<html><head></head><body><div id="root"></div></body></html>',data);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;/script&gt;'));
  assert.ok(html.includes('\\u003c/script>'));
});
