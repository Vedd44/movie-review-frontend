// Optional editorial context stays scoped to its collection, never to movie metadata.
function collectionMovieNote(collection, movie) {
  const slug = movie.canonical_slug || movie.slug;
  return collection.movieNotes?.[slug] || '';
}
function collectionItemList(collection, movies, origin) {
  return { '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: movies.map((movie, index) => ({
      '@type': 'ListItem', position: index + 1, name: movie.title,
      url: `${origin}/movies/${movie.canonical_slug || movie.slug || ''}`,
      ...(collectionMovieNote(collection, movie) ? { description: collectionMovieNote(collection, movie) } : {}),
    })),
  };
}
function collectionSocialImagePath(collection) {
  const version = Number.isInteger(collection.socialImageVersion) && collection.socialImageVersion > 0
    ? collection.socialImageVersion : 5;
  return `/social/collections/${collection.slug}-v${version}.jpg`;
}
module.exports = { collectionMovieNote, collectionItemList, collectionSocialImagePath };
