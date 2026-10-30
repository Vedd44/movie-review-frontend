import { createCollectionVisit, getCollectionReturn } from './collectionVisit';
import { COLLECTIONS, COLLECTION_CATEGORIES, getCollection } from './collections';
import movies from './generatedCollectionMovies.json';
const collection = getCollection('cozy-fall-movies');
const movie = movies['when-harry-met-sally-1989'];
test('every collection is discoverable in at least one valid category', () => {
  for (const c of COLLECTIONS) {
    expect(c.categories.length).toBeGreaterThan(0);
    for (const category of c.categories) expect(COLLECTION_CATEGORIES).toContain(category);
  }
});
test('return stays tied to the originating collection and exact movie', () => {
 const state = createCollectionVisit(collection,movie);
 expect(getCollectionReturn(state,movie)).toEqual({path:'/collections/cozy-fall-movies',title:collection.title});
 expect(getCollectionReturn(state,movies['you-ve-got-mail-1998'])).toBeNull();
 expect(getCollectionReturn(undefined,movie)).toBeNull();
 expect(getCollectionReturn({...state,source:'reelbot_pick'},movie)).toBeNull();
 expect(getCollectionReturn({...state,collectionVisit:{...state.collectionVisit,slug:'unknown'}},movie)).toBeNull();
 expect(getCollectionReturn({...state,collectionVisit:{...state.collectionVisit,moviePath:'/movies/wrong'}},movie)).toBeNull();
 expect(getCollectionReturn(createCollectionVisit(getCollection('great-thrillers-under-2-hours'),movie),movie)).toBeNull();
});
