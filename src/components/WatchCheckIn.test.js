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

jest.mock('../hooks/useTasteProfile', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../analytics', () => ({ trackProductEvent: jest.fn() }));

const React = require('react');
const { render, screen, fireEvent, waitFor, cleanup } = require('@testing-library/react');
const useTasteProfile = require('../hooks/useTasteProfile').default;
const WatchCheckIn = require('./WatchCheckIn').default;
let actions;
beforeEach(() => {
  localStorage.clear();
  actions = { toggleSeen: jest.fn().mockResolvedValue(undefined) };
  useTasteProfile.mockReturnValue({ profile: { recentRecommendations: [{ ...movie, recommended_at: new Date(Date.now() - 2 * 86400000).toISOString() }] }, actions, getMovieState: () => ({ seen: false }) });
});
afterEach(cleanup);

test('watch status saves before confirmation and does not ask for an opinion', async () => {
  render(<WatchCheckIn />);
  expect(screen.queryByRole('button', { name: 'Not for me' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Yes, I watched it' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('is now in Watched'));
  expect(actions.toggleSeen).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(screen.queryByRole('status')).toBeNull();
});

test('hide dismisses the question without modifying movie preferences', () => {
  render(<WatchCheckIn />);
  fireEvent.click(screen.getByRole('button', { name: 'Hide question' }));
  expect(JSON.parse(localStorage.getItem('reelbot:watch-check-in:guest'))).toEqual([1]);
  expect(actions.toggleSeen).not.toHaveBeenCalled();
  expect(screen.queryByText(/Did you watch/)).toBeNull();
});

test('not yet snoozes rather than permanently dismissing the movie', () => {
  render(<WatchCheckIn />);
  fireEvent.click(screen.getByRole('button', { name: 'Not yet' }));
  const snoozed = JSON.parse(localStorage.getItem('reelbot:watch-check-in:guest:snoozed'));
  expect(snoozed[1]).toBeGreaterThan(Date.now() + 6 * 86400000);
  expect(localStorage.getItem('reelbot:watch-check-in:guest')).toBeNull();
  expect(actions.toggleSeen).not.toHaveBeenCalled();
  expect(findWatchCheckIn({recentRecommendations:[movie]}, [], now, {1: now + 86400000})).toBeUndefined();
  expect(findWatchCheckIn({recentRecommendations:[movie]}, [], now, {1: now - 1})).toBe(movie);
});

test('failed watch update stays retryable and does not show success', async () => {
  actions.toggleSeen.mockRejectedValue(new Error('offline'));
  render(<WatchCheckIn />);
  fireEvent.click(screen.getByRole('button', { name: 'Yes, I watched it' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Couldn’t save'));
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByRole('button', { name: 'Yes, I watched it' }).disabled).toBe(false);
});
