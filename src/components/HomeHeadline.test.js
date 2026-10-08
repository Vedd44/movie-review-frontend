import { act, fireEvent, render, screen } from '@testing-library/react';
import HomeHeadline, { HEADLINE_PHRASES, HEADLINE_HOLD_MS, HEADLINE_SEQUENCE_LENGTH, headlineRequest } from './HomeHeadline';

let motion;
let visibility;
const advance = milliseconds => act(() => jest.advanceTimersByTime(milliseconds));
const visibleText = container => container.querySelector('.headline-phrase-visible').textContent;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  visibility = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  motion = { matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
  jest.spyOn(window, 'matchMedia').mockReturnValue(motion);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test.each(HEADLINE_PHRASES.map((phrase, index) => [index, phrase]))('starts at randomized phrase %i and selects its complete, unmodified request', (index, phrase) => {
  Math.random.mockReturnValue((index + .1) / HEADLINE_PHRASES.length);
  const onSelect = jest.fn();
  const { container, rerender } = render(<HomeHeadline onSelect={onSelect} />);
  expect(visibleText(container)).toBe(phrase);
  rerender(<HomeHeadline onSelect={onSelect} paused />);
  const button = screen.getByRole('button', { name: `Use this example: ${phrase}` });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toHaveAttribute('aria-controls', 'pick-prompt-input');
  fireEvent.click(button);
  expect(onSelect).toHaveBeenCalledWith(headlineRequest(phrase));
});

test('crossfades complete phrases twice over 8.4 seconds, without repeating or looping', () => {
  const { container } = render(<HomeHeadline onSelect={jest.fn()} />);
  const seen = [visibleText(container)];
  for (let index = 1; index < HEADLINE_SEQUENCE_LENGTH; index += 1) {
    advance(HEADLINE_HOLD_MS - 1);
    expect(visibleText(container)).toBe(HEADLINE_PHRASES[index - 1]);
    advance(1);
    expect(visibleText(container)).toBe(HEADLINE_PHRASES[index]);
    expect(container.querySelector('.headline-phrase-outgoing')).toHaveTextContent(HEADLINE_PHRASES[index - 1]);
    expect(container.querySelector('.headline-phrase-visible')).toHaveClass('is-entering');
    expect(screen.getByText('I want to watch...')).toBeVisible();
    seen.push(visibleText(container));
  }
  expect(seen).toEqual(HEADLINE_PHRASES.slice(0, 3));
  expect(container.querySelector('.headline-cursor')).toBeNull();
  expect(jest.getTimerCount()).toBe(0);
  advance(60000);
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[2]);
  expect(Math.random).toHaveBeenCalledTimes(1);
});

test('pauses while the page is hidden, resumes without catching up, and cleans up on unmount', () => {
  const remove = jest.spyOn(document, 'removeEventListener');
  const { container, unmount } = render(<HomeHeadline onSelect={jest.fn()} />);
  advance(HEADLINE_HOLD_MS);
  visibility.mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  expect(jest.getTimerCount()).toBe(0);
  advance(60000);
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[1]);
  visibility.mockReturnValue(false);
  fireEvent(document, new Event('visibilitychange'));
  advance(HEADLINE_HOLD_MS);
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[2]);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  expect(motion.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  ['visibilitychange', 'pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(event => expect(remove).toHaveBeenCalledWith(event, expect.any(Function)));
});

test.each(['pointerdown', 'keydown', 'touchstart', 'wheel'])('settles on the full phrase after %s and never restarts', event => {
  const { container } = render(<HomeHeadline onSelect={jest.fn()} />);
  advance(HEADLINE_HOLD_MS);
  fireEvent(document, new Event(event));
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[1]);
  expect(jest.getTimerCount()).toBe(0);
  advance(60000);
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[1]);
});

test('focus settles the full accessible phrase without repeated live announcements', () => {
  const select = jest.fn();
  const { container } = render(<HomeHeadline onSelect={select} />);
  advance(HEADLINE_HOLD_MS);
  const button = screen.getByRole('button', { name: `Use this example: ${HEADLINE_PHRASES[1]}` });
  expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('aria-live', 'off');
  expect(container.querySelector('.headline-phrase-visible')).toHaveAttribute('aria-hidden', 'true');
  expect(button).toHaveAccessibleDescription(/Your existing text stays unchanged/);
  fireEvent.focus(button);
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[1]);
  fireEvent.click(button);
  expect(select).toHaveBeenCalledWith('A movie everyone will love');
  expect(jest.getTimerCount()).toBe(0);
});

test('reduced motion gives a static usable phrase and no timers', () => {
  motion.matches = true;
  const select = jest.fn();
  const { container } = render(<HomeHeadline onSelect={select} />);
  expect(jest.getTimerCount()).toBe(0);
  advance(60000);
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[0]);
  fireEvent.click(screen.getByRole('button'));
  expect(select).toHaveBeenCalledWith("Something that'll keep me guessing");
});

test('changing the motion preference or pausing during a crossfade preserves the phrase and cancels timers', () => {
  const { container, rerender } = render(<HomeHeadline onSelect={jest.fn()} />);
  advance(HEADLINE_HOLD_MS);
  motion.matches = true;
  act(() => motion.addEventListener.mock.calls[0][1]());
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[1]);
  expect(jest.getTimerCount()).toBe(0);
  rerender(<HomeHeadline onSelect={jest.fn()} paused />);
  motion.matches = false;
  act(() => motion.addEventListener.mock.calls[0][1]());
  rerender(<HomeHeadline onSelect={jest.fn()} />);
  expect(jest.getTimerCount()).toBe(0);
});

test('an existing or focused request stops animation immediately', () => {
  const { container, rerender } = render(<HomeHeadline onSelect={jest.fn()} />);
  advance(HEADLINE_HOLD_MS);
  rerender(<HomeHeadline onSelect={jest.fn()} paused />);
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[1]);
  expect(jest.getTimerCount()).toBe(0);
  rerender(<HomeHeadline onSelect={jest.fn()} />);
  expect(jest.getTimerCount()).toBe(0);
});

test('wraps from the last random starting phrase without repeating during the short sequence', () => {
  Math.random.mockReturnValue(.99);
  const { container } = render(<HomeHeadline onSelect={jest.fn()} />);
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[4]);
  advance(HEADLINE_HOLD_MS);
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[0]);
  advance(HEADLINE_HOLD_MS);
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[1]);
  expect(jest.getTimerCount()).toBe(0);
});

test('hover settles a crossfade immediately on a complete phrase, removing the outgoing text', () => {
  const { container } = render(<HomeHeadline onSelect={jest.fn()} />);
  advance(HEADLINE_HOLD_MS);
  expect(container.querySelector('.headline-phrase-outgoing')).not.toBeNull();
  fireEvent.pointerEnter(screen.getByRole('button'));
  expect(container.querySelector('.headline-phrase-outgoing')).toBeNull();
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[1]);
  expect(jest.getTimerCount()).toBe(0);
});

test('a visit initially hidden does no animation work and reserves every complete phrase', () => {
  visibility.mockReturnValue(true);
  const { container } = render(<HomeHeadline onSelect={jest.fn()} />);
  expect(jest.getTimerCount()).toBe(0);
  const measurements = [...container.querySelectorAll('.headline-phrase-measure')];
  expect(measurements.map(node => node.textContent)).toEqual(HEADLINE_PHRASES);
  measurements.forEach(node => expect(node).toHaveAttribute('aria-hidden', 'true'));
  visibility.mockReturnValue(false);
  fireEvent(document, new Event('visibilitychange'));
  advance(HEADLINE_HOLD_MS);
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[1]);
});
