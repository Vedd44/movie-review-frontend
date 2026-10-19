import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DetailShare from './DetailShare';

const props = { path: '/movies/aliens-1986', title: 'Aliens (1986) | ReelBot', name: 'Aliens' };
const url = 'https://reelbot.movie/movies/aliens-1986';
const setup = extra => render(<DetailShare {...props} {...extra} />);
const click = () => fireEvent.click(screen.getByRole('button', { name: 'Share Aliens' }));
beforeEach(() => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue() } });
});

test('shares canonical production URL and complete title without query or private context', async () => {
  Object.defineProperty(navigator, 'share', { value: jest.fn().mockResolvedValue() });
  setup({ path: props.path + '?brief=private#watch' });
  click();
  expect(navigator.share).toHaveBeenCalledWith({ title: props.title, url });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Share Aliens' })).toBeEnabled());
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

test('without native sharing copies link and announces success', async () => {
  setup(); click();
  await screen.findByText('Link copied');
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith(url);
});

test('cancelling native sheet is quiet and permits retry without copying', async () => {
  Object.defineProperty(navigator, 'share', { value: jest.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) });
  setup(); click();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Share Aliens' })).toBeEnabled());
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  click();
  await waitFor(() => expect(navigator.share).toHaveBeenCalledTimes(2));
});

test.each(['NotAllowedError', 'InvalidStateError', 'DataError', 'TypeError'])('native %s offers explicit fresh-gesture Copy link fallback', async errorName => {
  Object.defineProperty(navigator, 'share', { value: jest.fn().mockRejectedValue({ name: errorName }) });
  setup(); click();
  const copy = await screen.findByRole('button', { name: 'Copy link' });
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: 'Link to Aliens' })).toHaveValue(url);
  fireEvent.click(copy);
  await screen.findByText('Link copied');
});

test.each([false, true])('clipboard unavailable or denied exposes selectable link and keyboard dismissal (%s)', async denied => {
  Object.defineProperty(navigator, 'clipboard', { value: denied ? { writeText: jest.fn().mockRejectedValue(new Error('Denied')) } : undefined });
  setup(); click();
  const input = await screen.findByRole('textbox', { name: 'Link to Aliens' });
  input.focus();
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(url.length);
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Share Aliens' })).toHaveFocus();
});

test('repeated clicks start one native share; navigating away ignores late result', async () => {
  let reject;
  Object.defineProperty(navigator, 'share', { value: jest.fn(() => new Promise((resolve, fail) => { reject = fail; })) });
  const view = setup(); click(); click();
  expect(navigator.share).toHaveBeenCalledTimes(1);
  view.unmount();
  setup({ name: 'New movie', path: '/movies/new-movie-2000' });
  await act(async () => reject(new Error('Late failure')));
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('repeated copy clicks are guarded until settled and Close restores focus', async () => {
  Object.defineProperty(navigator, 'share', { value: jest.fn().mockRejectedValue(new Error('Unavailable')) });
  setup(); click();
  const copy = await screen.findByRole('button', { name: 'Copy link' });
  let resolve;
  navigator.clipboard.writeText.mockImplementation(() => new Promise(done => { resolve = done; }));
  fireEvent.click(copy); fireEvent.click(copy);
  expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('button', { name: 'Share Aliens' })).toHaveFocus();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

test.each(['resolve', 'reject'])('closing during pending copy ignores late %s and restores focus', async outcome => {
  Object.defineProperty(navigator, 'share', { value: jest.fn().mockRejectedValue(new Error('Unavailable')) });
  setup(); click();
  const copy = await screen.findByRole('button', { name: 'Copy link' });
  let finish;
  navigator.clipboard.writeText.mockImplementation(() => new Promise((resolve, reject) => { finish = outcome === 'resolve' ? resolve : reject; }));
  fireEvent.click(copy);
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Share Aliens' })).toHaveFocus();
  await act(async () => finish(new Error('Late result')));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
  expect(screen.getByRole('button', { name: 'Share Aliens' })).toBeEnabled();
});
