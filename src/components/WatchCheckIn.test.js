import { findWatchCheckIn } from './WatchCheckIn';
const now=Date.parse('2026-10-03T12:00:00Z');
const movie={id:1,title:'A movie',recommended_at:'2026-10-01T12:00:00Z'};
const history = (pick = movie) => [{movie_ids: [pick.id], saved_at: pick.recommended_at}];
test('return prompt uses existing history and excludes seen, skipped or dismissed picks', () => {
  expect(findWatchCheckIn({recentRecommendations:[movie],pickHistory:history()},[],now)).toBe(movie);
  for (const profile of [{recentRecommendations:[movie],pickHistory:history(),seen:[{id:1}]},{recentRecommendations:[movie],pickHistory:history(),skipped:[{id:'1'}]}]) expect(findWatchCheckIn(profile,[],now)).toBeUndefined();
  expect(findWatchCheckIn({recentRecommendations:[movie],pickHistory:history()},[1],now)).toBeUndefined();
});
test('no reminder for fresh picks, stale picks or invalid timestamps', () => {
  for (const recommended_at of ['2026-10-03T11:00:00Z','2026-08-01T12:00:00Z','bad']) expect(findWatchCheckIn({recentRecommendations:[{...movie,recommended_at}],pickHistory:history({...movie,recommended_at})},[],now)).toBeUndefined();
});

jest.mock('../hooks/useTasteProfile', () => ({ __esModule: true, default: jest.fn() }));
let mockUser = null;
let mockAuthReady = true;
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, authReady: mockAuthReady }) }));
jest.mock('../analytics', () => ({ trackProductEvent: jest.fn() }));

const React = require('react');
const { render, screen, fireEvent, waitFor, cleanup } = require('@testing-library/react');
const useTasteProfile = require('../hooks/useTasteProfile').default;
const WatchCheckIn = require('./WatchCheckIn').default;
let actions;
beforeEach(() => {
  localStorage.clear();
  mockUser = null; mockAuthReady = true;
  actions = { toggleSeen: jest.fn().mockResolvedValue(undefined), toggleSkipped: jest.fn().mockResolvedValue(undefined) };
  const pick = { ...movie, recommended_at: new Date(Date.now() - 2 * 86400000).toISOString() };
  useTasteProfile.mockReturnValue({ isProfileReady: true, profile: { recentRecommendations: [pick], pickHistory: history(pick) }, actions, getMovieState: () => ({ seen: false }) });
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
  expect(findWatchCheckIn({recentRecommendations:[movie],pickHistory:history()}, [], now, {1: now + 86400000})).toBeUndefined();
  expect(findWatchCheckIn({recentRecommendations:[movie],pickHistory:history()}, [], now, {1: now - 1})).toBe(movie);
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
  expect(await screen.findByRole('status')).toBeTruthy();
 });

test('dismissal leaves the homepage quiet instead of cycling through other picks', () => {
  const value = useTasteProfile();
  value.profile.recentRecommendations.push({...movie,id:2,title:'Another movie',recommended_at:new Date(Date.now()-3*86400000).toISOString()});
  value.profile.pickHistory.push(...history(value.profile.recentRecommendations[1]));
  render(<WatchCheckIn />);
  fireEvent.click(screen.getByRole('button', {name:'Dismiss last pick'}));
  expect(screen.queryByRole('region', {name:'Your last pick'})).toBeNull();
  expect(actions.toggleSeen).not.toHaveBeenCalled();
  expect(actions.toggleSkipped).not.toHaveBeenCalled();
});

const { tasteProfileService } = require('../services/tasteProfileService');
const DAY = 86400000;
const weeklyKey = 'reelbot:watch-check-in:guest:shown-at';

test('recorded alternatives never become the primary check-in, even though stored first', () => {
  const profile = tasteProfileService.recordPickResult(tasteProfileService.createEmptyProfile(), {prompt:'a comedy'}, {
    primary:{id:11,title:'Displayed primary'}, alternates:[{id:12,title:'Queued alternate'}, {id:13,title:'Another alternate'}],
  });
  expect(profile.recentRecommendations[0].id).toBe(13); // Reproduces the production ordering.
  expect(findWatchCheckIn(profile, [], Date.now() + 2 * DAY).id).toBe(11);
  tasteProfileService.save(profile);
  expect(findWatchCheckIn(tasteProfileService.load(), [], Date.now() + 2 * DAY).id).toBe(11);
});

test('a later alternate appearance cannot replace the newest primary or change its event date', () => {
  const profile = {
    recentRecommendations:[{...movie, recommended_at:new Date(now).toISOString()}, {id:2,title:'Latest primary'}],
    pickHistory:[{movie_ids:[1],saved_at:new Date(now-3*DAY).toISOString()}, {movie_ids:[2,1],saved_at:new Date(now-2*DAY).toISOString()}],
  };
  expect(findWatchCheckIn(profile, [], now).id).toBe(2);
  profile.seen = [{id:2}];
  expect(findWatchCheckIn(profile, [], now)).toBeUndefined();
});

test.each(['fresh', 'dismissed', 'seen', 'skipped', 'snoozed', 'missing'])('an ineligible latest primary (%s) never falls back to an older film or alternate', reason => {
  const latest = {id:2,title:'Latest primary'};
  const profile = {recentRecommendations:[movie,latest,{id:3,title:'Unused alternate'}],pickHistory:[...history(),{movie_ids:[2,3],saved_at:new Date(now-2*DAY+1).toISOString()}]};
  const dismissed = [], snoozed = {};
  if (reason === 'fresh') profile.pickHistory[1].saved_at = new Date(now-1000).toISOString();
  if (reason === 'dismissed') dismissed.push(2);
  if (reason === 'seen') profile.seen = [{id:2}];
  if (reason === 'skipped') profile.skipped = [{id:'2'}];
  if (reason === 'snoozed') snoozed[2] = now + DAY;
  if (reason === 'missing') profile.recentRecommendations = [movie];
  expect(findWatchCheckIn(profile,dismissed,now,snoozed)).toBeUndefined();
});

test.each([undefined, [], [{movie_ids:[1]}], [{movie_ids:[1],saved_at:'bad'}], [{movie_ids:'1',saved_at:movie.recommended_at}], [{movie_ids:[-1],saved_at:movie.recommended_at}], [null]])('unproven or malformed legacy history fails closed: %j', pickHistory => {
  expect(findWatchCheckIn({recentRecommendations:[movie],pickHistory}, [], now)).toBeUndefined();
});

test('weekly impression cooldown survives remount without an answer', () => {
  const view = render(<WatchCheckIn />);
  expect(screen.getByRole('region', {name:'Your last pick'})).toBeTruthy();
  expect(Number(localStorage.getItem(weeklyKey))).toBeGreaterThan(0);
  view.unmount();
  render(<WatchCheckIn />);
  expect(screen.queryByRole('region', {name:'Your last pick'})).toBeNull();
  expect(actions.toggleSeen).not.toHaveBeenCalled();
  expect(actions.toggleSkipped).not.toHaveBeenCalled();
});

test('weekly cooldown boundary allows a check-in at seven days, never before', () => {
  const date = Date.now();
  jest.spyOn(Date, 'now').mockReturnValue(date);
  localStorage.setItem(weeklyKey, String(date-7*DAY+1));
  const view = render(<WatchCheckIn />);
  expect(screen.queryByRole('region', {name:'Your last pick'})).toBeNull();
  view.unmount();
  localStorage.setItem(weeklyKey, String(date-7*DAY));
  render(<WatchCheckIn />);
  expect(screen.getByRole('region', {name:'Your last pick'})).toBeTruthy();
  Date.now.mockRestore();
});

test('StrictMode retains the first impression and suppresses a real remount', () => {
  const view = render(<React.StrictMode><WatchCheckIn /></React.StrictMode>);
  expect(screen.getByRole('region', {name:'Your last pick'})).toBeTruthy();
  view.unmount();
  render(<React.StrictMode><WatchCheckIn /></React.StrictMode>);
  expect(screen.queryByRole('region', {name:'Your last pick'})).toBeNull();
});

test.each(['Dismiss last pick','Maybe later'])('%s survives remount without cycling through the backlog', label => {
  const view = render(<WatchCheckIn />);
  fireEvent.click(screen.getByRole('button', {name:label}));
  view.unmount(); render(<WatchCheckIn />);
  expect(screen.queryByRole('region', {name:'Your last pick'})).toBeNull();
  expect(actions.toggleSeen).not.toHaveBeenCalled();
  expect(actions.toggleSkipped).not.toHaveBeenCalled();
});

test('an account transition unmounts the old selection and uses independent cadence', () => {
  mockUser = {id:'a'};
  const view = render(<WatchCheckIn />);
  expect(screen.getByText('A movie')).toBeTruthy();
  mockUser = {id:'b'};
  const value = useTasteProfile(); value.isProfileReady = false;
  view.rerender(<WatchCheckIn />);
  expect(screen.queryByText('A movie')).toBeNull();
  const pick = {...movie,id:2,title:'B movie',recommended_at:new Date(Date.now()-2*DAY).toISOString()};
  value.profile = {recentRecommendations:[pick],pickHistory:history(pick)}; value.isProfileReady = true;
  view.rerender(<WatchCheckIn />);
  expect(screen.getByText('B movie')).toBeTruthy();
  expect(localStorage.getItem('reelbot:watch-check-in:a:shown-at')).toBeTruthy();
  expect(localStorage.getItem('reelbot:watch-check-in:b:shown-at')).toBeTruthy();
});

test('auth restoration never displays a guest profile before identity is known', () => {
  mockAuthReady = false;
  render(<WatchCheckIn />);
  expect(screen.queryByRole('region', {name:'Your last pick'})).toBeNull();
  expect(localStorage.getItem(weeklyKey)).toBeNull();
});

test('a new fresh pick removes an already mounted old check-in', () => {
  const view = render(<WatchCheckIn />);
  const value = useTasteProfile();
  value.profile.pickHistory.unshift({movie_ids:[2],saved_at:new Date().toISOString()});
  view.rerender(<WatchCheckIn />);
  expect(screen.queryByRole('region', {name:'Your last pick'})).toBeNull();
});

test('malformed cadence state stays quiet instead of repeating the optional prompt', () => {
  localStorage.setItem(weeklyKey,'broken');
  render(<WatchCheckIn />);
  expect(screen.queryByRole('region', {name:'Your last pick'})).toBeNull();
});

test('future cadence timestamps stay quiet after a clock change', () => {
  localStorage.setItem(weeklyKey,String(Date.now()+DAY));
  render(<WatchCheckIn />);
  expect(screen.queryByRole('region', {name:'Your last pick'})).toBeNull();
});

test('saving keeps the acknowledgement visible after the profile starts excluding the film', async () => {
  const view = render(<WatchCheckIn />);
  fireEvent.click(screen.getByRole('button', {name:'Seen it'}));
  const value = useTasteProfile(); value.profile.seen = [{id:1}];
  view.rerender(<WatchCheckIn />);
  expect(await screen.findByRole('status')).toHaveTextContent('is now in Watched');
});
