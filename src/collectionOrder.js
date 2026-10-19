// Verified first-publication dates, in the site's existing New York calendar.
// Older collections have no inferred dates and remain in the alphabetical group.
const PUBLISHED_DATES = Object.freeze({
  'animated-movies-for-adults': '2026-10-15',
  'haunted-house-ghost-stories': '2026-10-18',
});
const DAY = 24 * 60 * 60 * 1000;
const calendar = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});
const OCTOBER = new Set(['best-halloween-movies', 'family-halloween-movies',
  'best-horror-movies', 'scariest-movies', 'goriest-horror-movies',
  'best-slasher-movies', 'haunted-house-ghost-stories']);
const CHRISTMAS = new Set(['best-christmas-movies', 'family-christmas-movies',
  'christmas-movies-for-adults', 'christmas-horror-movies']);

function collectionCalendarDay(now = Date.now()) {
  const value = new Date(now);
  if (!Number.isFinite(value.getTime())) return null;
  const parts = Object.fromEntries(calendar.formatToParts(value).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function sortCollections(collections, now = Date.now()) {
  const day = collectionCalendarDay(now);
  const month = day ? Number(day.slice(5, 7)) : 0;
  const today = day ? Date.parse(`${day}T00:00:00Z`) : NaN;
  const rank = (collection) => {
    const seasonal = (month === 10 && OCTOBER.has(collection.slug)) ||
      ([9, 10, 11].includes(month) && collection.slug === 'cozy-fall-movies') ||
      (month === 12 && CHRISTMAS.has(collection.slug)) ||
      ([12, 1, 2].includes(month) && collection.slug === 'best-winter-movies');
    const published = Date.parse(`${PUBLISHED_DATES[collection.slug]}T00:00:00Z`);
    const age = (today - published) / DAY;
    const recent = age >= 0 && age < 30;
    return { group: seasonal ? 0 : recent ? 1 : 2, published: recent ? published : 0 };
  };
  return collections.slice().sort((a, b) => {
    const x = rank(a), y = rank(b);
    return x.group - y.group || y.published - x.published ||
      a.title.localeCompare(b.title, 'en', { sensitivity: 'base', numeric: true }) ||
      a.slug.localeCompare(b.slug, 'en');
  });
}

// Bound both edge-cache freshness and live tabs at the next local midnight,
// including the 23/25-hour daylight-saving days. No stale seasonal ordering.
function getNextCollectionBoundary(now = Date.now()) {
  const start = new Date(now).getTime();
  const day = collectionCalendarDay(start);
  if (!day) return null;
  let lo = start, hi = start + 27 * 60 * 60 * 1000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (collectionCalendarDay(mid) === day) lo = mid;
    else hi = mid;
  }
  return hi;
}
module.exports = { sortCollections, collectionCalendarDay, getNextCollectionBoundary };
