const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {getPageData} = require('./pageData');
test('news route returns a real page and canonical legacy redirect', async () => {
 const data = await getPageData('/news'); assert.equal(data.path, '/news'); assert.equal(data.title,'Movie news | ReelBot'); assert.equal(data.robots,'noindex,follow');
 assert.deepEqual(await getPageData('/movie-news'),{redirect:'/news'});
});
test('home news follows the how-to section and preserves seasonal collections and anchor fix', () => {
 const home=fs.readFileSync(require.resolve('../src/Home.js'),'utf8');
 assert.ok(home.includes('{featured.isOctober ? featuredCollectionSection : null}'));
 assert.ok(home.includes('{!featured.isOctober ? featuredCollectionSection : null}'));
 assert.equal((home.match(/<MovieNewsHome \/>/g) || []).length, 1);
 assert.ok(home.indexOf('<MovieNewsHome />') > home.indexOf('Try it with your own request'));
 assert.ok(home.includes('[location.key, location.pathname, location.hash, scrollToPickResults, scrollToSection]'));
});
