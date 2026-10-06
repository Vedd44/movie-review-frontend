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
  actions = { toggleSeen: jest.fn().mockResolvedValue(undefined), toggleSkipped: jest.fn().mockResolvedValue(undefined) };
  useTasteProfile.mockReturnValue({ profile: { recentRecommendations: [{ ...movie, recommended_at: new Date(Date.now() - 2 * 86400000).toISOString() }] }, actions, getMovieState: () => ({ seen: false }) });
});
afterEach(cleanup);

test('watch status saves before confirmation and does not ask for an opinion', async () => {
  render(<WatchCheckIn />);
  expect(screen.queryByRole('button', { name: 'Not for me' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Seen it' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('is now in Watched'));
  expect(actions.toggleSeen).toHaveBeenCalledTimes(1);
  expect(actions.toggleSeen).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { historyOnly: true });
  expect(screen.getByRole("status").textContent).toContain("prioritize movies you haven’t seen");
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(screen.queryByRole('status')).toBeNull();
});

test('hide dismisses the question without modifying movie preferences', () => {
  render(<WatchCheckIn />);
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss last pick' }));
  expect(JSON.parse(localStorage.getItem('reelbot:watch-check-in:guest'))).toEqual([1]);
  expect(actions.toggleSeen).not.toHaveBeenCalled();
  expect(screen.queryByText(/Did you watch/)).toBeNull();
});

test('not yet snoozes rather than permanently dismissing the movie', () => {
  render(<WatchCheckIn />);
  fireEvent.click(screen.getByRole('button', { name: 'Maybe later' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Seen it' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Couldn’t save'));
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByRole('button', { name: 'Seen it' }).disabled).toBe(false);
});

 test('not interested saves the title to Not for me without interpreting its genre', async () => {
  render(<WatchCheckIn />);
  fireEvent.click(screen.getByRole('button', {name: 'Not interested'}));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('is now in Not for me'));
  expect(actions.toggleSkipped).toHaveBeenCalledWith(expect.objectContaining({id: 1}), {titleOnly: true});
  expect(actions.toggleSeen).not.toHaveBeenCalled();
 });
 test('saving disables all responses until persistence finishes', async () => {
  let finish;
  actions.toggleSeen.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  render(<WatchCheckIn />);
  fireEvent.click(screen.getByRole('button', {name: 'Seen it'}));
  expect(screen.queryByRole('status')).toBeNull();
  for (const button of screen.getAllByRole('button')) expect(button.disabled).toBe(true);
  finish();
  await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
 });

test('dismissal leaves the homepage quiet instead of cycling through other picks', () => {
  useTasteProfile.mockReturnValue({profile:{recentRecommendations:[{...movie,recommended_at:new Date(Date.now()-2*86400000).toISOString()},{...movie,id:2,title:'Another movie',recommended_at:new Date(Date.now()-3*86400000).toISOString()}]},actions,getMovieState:()=>({seen:false,skipped:false})});
  render(<WatchCheckIn />);
  fireEvent.click(screen.getByRole('button', {name:'Dismiss last pick'}));
  expect(screen.queryByRole('region', {name:'Your last pick'})).toBeNull();
  expect(actions.toggleSeen).not.toHaveBeenCalled();
  expect(actions.toggleSkipped).not.toHaveBeenCalled();
});
