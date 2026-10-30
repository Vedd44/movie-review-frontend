import { getCollection } from './collections';
import { getMoviePath } from './discovery';

// Router-entry state belongs to this film visit, not a global last collection.
// Canonical/shared URLs and structured breadcrumbs remain unchanged.
export function createCollectionVisit(collection, movie) {
  if (!collection || !movie?.id) return undefined;
  return { source: 'collection', collectionVisit: {
    slug: collection.slug, movieId: Number(movie.id), moviePath: getMoviePath(movie),
  } };
}

export function getCollectionReturn(state, movie) {
  const visit = state?.source === 'collection' ? state.collectionVisit : null;
  if (!visit || !movie?.id || visit.movieId !== Number(movie.id)) return null;
  const collection = getCollection(visit.slug);
  const moviePath = getMoviePath(movie);
  if (!collection || visit.moviePath !== moviePath || !collection.movies.some(slug => moviePath === `/movies/${slug}`)) return null;
  return { path: `/collections/${collection.slug}`, title: collection.title };
}
