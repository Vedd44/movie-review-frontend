const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {getPageData} = require('./pageData');
test('news route returns a real page and canonical legacy redirect', async () => {
 const data = await getPageData('/news'); assert.equal(data.path, '/news'); assert.equal(data.title,'Movie news | ReelBot'); assert.equal(data.robots,'noindex,follow');
 assert.deepEqual(await getPageData('/movie-news'),{redirect:'/news'});
});
test('home news follows each seasonal collection placement and preserves anchor fix', () => {
 const home=fs.readFileSync(require.resolve('../src/Home.js'),'utf8');
 assert.ok(home.includes('{featured.isOctober ? <>{featuredCollectionSection}{!isFeedRoute && <MovieNewsHome />}</> : null}'));
 assert.ok(home.includes('{!featured.isOctober ? <>{featuredCollectionSection}{!isFeedRoute && <MovieNewsHome />}</> : null}'));
 assert.ok(home.includes('[location.key, location.pathname, location.hash, scrollToPickResults, scrollToSection]'));
});
