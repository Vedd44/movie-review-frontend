import { COLLECTIONS } from './collections';
import { collectionCalendarDay, getNextCollectionBoundary, sortCollections } from './collectionOrder';
const titles = (items) => items.map(({ title }) => title);
const slugs = (when) => sortCollections(COLLECTIONS, when).map(({ slug }) => slug);
test('October puts timely picks first, verified recent additions next, then A–Z without mutating data', () => {
  const original = [...COLLECTIONS];
  const ordered = sortCollections(COLLECTIONS, '2026-10-19T01:00:00Z');
  expect(ordered[0].slug).toBe('haunted-house-ghost-stories');
  expect(ordered[8].slug).toBe('animated-movies-for-adults');
  expect(titles(ordered.slice(9))).toEqual(titles(ordered.slice(9)).sort((a,b) => a.localeCompare(b, 'en', { sensitivity:'base', numeric:true })));
  expect(COLLECTIONS).toEqual(original);
  expect(new Set(ordered.map(c => c.slug)).size).toBe(COLLECTIONS.length);
});
test.each([
  ['2026-09-01T04:00:00Z', 'cozy-fall-movies'],
  ['2026-11-01T03:59:59Z', 'haunted-house-ghost-stories'],
  ['2026-11-01T04:00:00Z', 'cozy-fall-movies'],
  ['2026-12-01T04:59:59Z', 'cozy-fall-movies'],
  ['2026-12-01T05:00:00Z', 'best-christmas-movies'],
  ['2027-01-01T05:00:00Z', 'best-winter-movies'],
  ['2027-03-01T05:00:00Z', 'animated-movies-for-adults'],
])('seasonal calendar at %s begins with %s', (now, first) => expect(slugs(now)[0]).toBe(first));
test('recent publication dates expire after 30 calendar days and never promote future additions', () => {
  expect(slugs('2026-11-13T12:00:00Z').slice(0,3)).toEqual(['cozy-fall-movies','haunted-house-ghost-stories','animated-movies-for-adults']);
  expect(slugs('2026-11-14T12:00:00Z').slice(0,3)).toEqual(['cozy-fall-movies','haunted-house-ghost-stories','animated-movies-for-adults']);
  // Adult Animation now occupies its ordinary alphabetical slot after the recent Haunted item.
  expect(slugs('2026-11-17T12:00:00Z').slice(0,3)).toEqual(['cozy-fall-movies','animated-movies-for-adults','best-90s-action-movies']);
  const fixtures = [{slug:'haunted-house-ghost-stories',title:'Z'}, {slug:'a',title:'A'}];
  expect(sortCollections(fixtures, '2026-08-01T12:00:00Z')[0].slug).toBe('a');
});
test.each([
  ['2026-11-01T04:00:00Z', '2026-11-02T05:00:00Z'],
  ['2027-03-14T05:00:00Z', '2027-03-15T04:00:00Z'],
  ['2026-12-31T23:00:00Z', '2027-01-01T05:00:00Z'],
])('next midnight handles DST/year rollover from %s', (now, next) => {
  expect(getNextCollectionBoundary(now)).toBe(Date.parse(next));
});
test('invalid dates safely fall back to stable alphabetical ordering', () => {
  expect(collectionCalendarDay('invalid')).toBeNull();
  expect(getNextCollectionBoundary('invalid')).toBeNull();
  expect(sortCollections([{slug:'z',title:'Same'},{slug:'a',title:'Same'}], 'invalid')[0].slug).toBe('a');
});
