// Never publish a degraded social card when one of its poster downloads fails.
// Throw before any image processing/write so an existing output stays untouched.
function requireCompletePosters(collection, posters) {
  const expected = Math.min(3, collection.movies.length);
  if (expected === 0 || posters.length !== expected || posters.some((poster) => !Buffer.isBuffer(poster) || poster.length === 0)) {
    throw new Error(`Incomplete poster artwork for ${collection.slug}; preserving existing artwork and stopping the build.`);
  }
  return posters;
}

module.exports = { requireCompletePosters };
