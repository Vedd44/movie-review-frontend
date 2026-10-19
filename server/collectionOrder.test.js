const test = require('node:test');
const assert = require('node:assert/strict');
const { readCollections } = require('./collections');
const { getPageData } = require('./pageData');
const { sortCollections } = require('../src/collectionOrder');
const collections = readCollections();
for (const date of ['2026-10-19T01:00:00Z','2026-11-01T03:59:59Z','2026-11-01T04:00:00Z','2027-01-01T05:00:00Z']) {
  test('server index matches shared client ordering at '+date, async () => {
    const now = Date.parse(date);
    const data = await getPageData('/collections', new URLSearchParams(), {collections, now});
    const rendered = [...data.content.matchAll(/href="\/collections\/([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(rendered, Array.from(sortCollections(collections, now), c => c.slug));
  });
}
test('index edge cache cannot carry October order past New York midnight', async () => {
  const data = await getPageData('/collections', new URLSearchParams(), {collections, now:Date.parse('2026-11-01T03:59:59Z')});
  assert.equal(data.cacheMaxAgeSeconds,1);
  assert.equal(data.cacheStaleSeconds,0);
});
