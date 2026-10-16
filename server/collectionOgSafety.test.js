const test = require('node:test');
const assert = require('node:assert/strict');
const { requireCompletePosters } = require('./collectionOgSafety');
const collection = { slug: 'test-collection', movies: ['one', 'two', 'three', 'four'] };
const poster = Buffer.from('verified image bytes');

test('complete poster set retains order and buffers', () => {
  const posters = [poster, Buffer.from('second'), Buffer.from('third')];
  assert.equal(requireCompletePosters(collection, posters), posters);
});
test('missing, failed, empty, or non-image download buffers stop generation', () => {
  for (const posters of [[poster], [poster, null, poster], [null, null, null], [poster, Buffer.alloc(0), poster], [poster, 'not a buffer', poster]]) {
    assert.throws(() => requireCompletePosters(collection, posters), /preserving existing artwork and stopping the build/);
  }
});
test('small collections require every available poster and empty collections fail', () => {
  assert.deepEqual(requireCompletePosters({ slug: 'one', movies: ['one'] }, [poster]), [poster]);
  assert.throws(() => requireCompletePosters({ slug: 'empty', movies: [] }, []));
});
