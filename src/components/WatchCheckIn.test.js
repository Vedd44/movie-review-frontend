import { findWatchCheckIn } from './WatchCheckIn';
const now=Date.parse('2026-10-03T12:00:00Z');
const movie={id:1,title:'A movie',recommended_at:'2026-10-01T12:00:00Z'};
test('return prompt uses existing history and excludes seen, skipped or dismissed picks', () => {
  expect(findWatchCheckIn({recentRecommendations:[movie]},[],now)).toBe(movie);
  for (const profile of [{recentRecommendations:[movie],seen:[{id:1}]},{recentRecommendations:[movie],skipped:[{id:'1'}]}]) expect(findWatchCheckIn(profile,[],now)).toBeUndefined();
  expect(findWatchCheckIn({recentRecommendations:[movie]},[1],now)).toBeUndefined();
});
test('no reminder for fresh picks, stale picks or invalid timestamps', () => {
  for (const recommended_at of ['2026-10-03T11:00:00Z','2026-08-01T12:00:00Z','bad']) expect(findWatchCheckIn({recentRecommendations:[{...movie,recommended_at}]},[],now)).toBeUndefined();
});
