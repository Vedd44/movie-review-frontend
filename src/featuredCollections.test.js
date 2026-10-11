import { COLLECTIONS } from './collections';
import { getFeaturedCollections, getNextFeaturedBoundary, OCTOBER_START, OCTOBER_END } from './featuredCollections';
import manifest from './generatedCollectionMovies.json';
import previews from './generatedCollectionPreviews.json';

const evergreen = ['best-90s-action-movies', 'movies-like-heat', 'movies-like-interstellar'];
const october = ['best-halloween-movies', 'cozy-fall-movies', 'scariest-movies'];
const slugs = now => getFeaturedCollections(COLLECTIONS, now).collections.map(c => c.slug);

test('runs only in October 2026 using New York midnight boundaries', () => {
  expect(slugs(OCTOBER_START - 1)).toEqual(evergreen);
  expect(slugs(OCTOBER_START)).toEqual(october);
  expect(slugs(Date.parse('2026-11-01T03:59:59.999Z'))).toEqual(october);
  expect(slugs(OCTOBER_END)).toEqual(evergreen);
  expect(slugs(Date.parse('2027-10-15T12:00:00Z'))).toEqual(evergreen);
  expect(slugs(NaN)).toEqual(evergreen);
});

test('boundary scheduling ends after this campaign', () => {
  expect(getNextFeaturedBoundary(OCTOBER_START - 1)).toBe(OCTOBER_START);
  expect(getNextFeaturedBoundary(OCTOBER_START)).toBe(OCTOBER_END);
  expect(getNextFeaturedBoundary(OCTOBER_END)).toBeNull();
});

test('uses unique existing collections without changing catalog order and has cached posters', () => {
  const before = COLLECTIONS.map(c => c.slug);
  const featured = getFeaturedCollections(COLLECTIONS, OCTOBER_START);
  expect(featured.collections).toHaveLength(3);
  expect(new Set(featured.collections.map(c => c.slug)).size).toBe(3);
  expect(COLLECTIONS.map(c => c.slug)).toEqual(before);
  featured.collections.forEach(c => c.movies.slice(0, 3).forEach(slug => expect(previews[slug]?.poster_path).toBeTruthy()));
  expect(getFeaturedCollections([], OCTOBER_START).collections).toEqual([]);
});

test('the corrected under-two-hours promise is true for every movie', () => {
  const collection = COLLECTIONS.find(c => c.slug === 'great-thrillers-under-2-hours');
  expect(collection.movies).toHaveLength(14);
  collection.movies.forEach(slug => {
    expect(manifest[slug].runtime).toBeGreaterThan(0);
    expect(manifest[slug].runtime).toBeLessThan(120);
  });
});
