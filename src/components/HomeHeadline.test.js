/* These visual-only, aria-hidden characters need DOM inspection to verify stable animation nodes. */
/* eslint-disable testing-library/no-node-access, testing-library/no-container */
import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import HomeHeadline, { HEADLINE_PHRASES, HEADLINE_START_MS, HEADLINE_CHARACTER_MS, headlineRequest } from './HomeHeadline';

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

test.each(HEADLINE_PHRASES.map((phrase, index) => [index, phrase]))('reveals randomized phrase %i once and selects its complete request even during typing', (index, phrase) => {
  Math.random.mockReturnValue((index + .1) / HEADLINE_PHRASES.length);
  const onSelect = jest.fn();
  const { container, rerender } = render(<HomeHeadline onSelect={onSelect} />);
  expect(visibleText(container)).toBe(phrase);
  const characters = [...container.querySelectorAll('.headline-character')];
  expect(characters.map(node => node.textContent).join('')).toBe(phrase);
  characters.forEach((node, i) => expect(node.style.animationDelay).toBe(`${HEADLINE_START_MS + i * HEADLINE_CHARACTER_MS}ms`));
  expect(HEADLINE_START_MS + (characters.length - 1) * HEADLINE_CHARACTER_MS).toBeLessThan(1500);
  const button = screen.getByRole('button', { name: `Use this example: ${phrase}` });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toHaveAttribute('aria-controls', 'pick-prompt-input');
  advance(60000);
  rerender(<HomeHeadline onSelect={onSelect} />);
  expect(visibleText(container)).toBe(phrase);
  expect([...container.querySelectorAll('.headline-character')]).toEqual(characters);
  expect(Math.random).toHaveBeenCalledTimes(1);
  fireEvent.click(button);
  expect(onSelect).toHaveBeenCalledWith(headlineRequest(phrase));
  expect(button).toHaveClass('is-settled');
});

test('StrictMode and ordinary rerenders preserve nodes and one bounded completion timer', () => {
  const { container, rerender } = render(<StrictMode><HomeHeadline onSelect={jest.fn()} /></StrictMode>);
  const first = container.querySelector('.headline-character');
  rerender(<StrictMode><HomeHeadline onSelect={jest.fn()} /></StrictMode>);
  expect(container.querySelector('.headline-character')).toBe(first);
  expect(screen.getByText('I want to watch...')).toBeVisible();
  expect(jest.getTimerCount()).toBe(1);
  advance(2000);
  expect(jest.getTimerCount()).toBe(0);
  expect(container.querySelector('.headline-cursor')).toBeNull();
});

test('hidden pages pause CSS animation and clean up event listeners on unmount', () => {
  const remove = jest.spyOn(document, 'removeEventListener');
  const { unmount } = render(<HomeHeadline onSelect={jest.fn()} />);
  visibility.mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.getByRole('button')).toHaveClass('is-hidden');
  visibility.mockReturnValue(false);
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.getByRole('button')).not.toHaveClass('is-hidden');
  unmount();
  expect(motion.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  ['visibilitychange', 'input'].forEach(event => expect(remove).toHaveBeenCalledWith(event, expect.any(Function)));
});

test.each(['pointerdown', 'keydown', 'touchstart', 'wheel'])('%s outside request editing does not cancel the reveal', event => {
  render(<HomeHeadline onSelect={jest.fn()} />);
  fireEvent(document, new Event(event));
  expect(screen.getByRole('button')).not.toHaveClass('is-settled');
});

test('request input settles permanently, while restored text, autofocus and unrelated input do not', () => {
  const view = render(<><HomeHeadline onSelect={jest.fn()} /><textarea id="pick-prompt-input" aria-label="Request" defaultValue="Saved request" autoFocus /><input aria-label="Other" /></>);
  expect(screen.getByRole('textbox', { name: 'Request' })).toHaveFocus();
  const button = screen.getByRole('button');
  expect(button).not.toHaveClass('is-settled');
  fireEvent.input(screen.getByRole('textbox', { name: 'Other' }), { target: { value: 'Other text' } });
  fireEvent.pointerEnter(button);
  expect(button).not.toHaveClass('is-settled');
  fireEvent.input(screen.getByRole('textbox', { name: 'Request' }), { target: { value: 'Edited request' } });
  expect(button).toHaveClass('is-settled');
  view.rerender(<HomeHeadline onSelect={jest.fn()} />);
  expect(button).toHaveClass('is-settled');
});

test.each(['focus'])('%s settles with a complete accessible phrase and no letter announcements', event => {
  const select = jest.fn();
  const { container } = render(<HomeHeadline onSelect={select} />);
  const button = screen.getByRole('button', { name: `Use this example: ${HEADLINE_PHRASES[0]}` });
  expect(screen.getByRole('heading', { level: 1 })).toHaveAttribute('aria-live', 'off');
  expect(container.querySelector('.headline-phrase-visible')).toHaveAttribute('aria-hidden', 'true');
  expect(button).toHaveAccessibleDescription(/replacing any existing text/);
  fireEvent[event](button);
  expect(button).toHaveClass('is-settled');
  fireEvent.click(button);
  expect(select).toHaveBeenCalledWith(headlineRequest(HEADLINE_PHRASES[0]));
});

test('reduced motion immediately gives a static usable phrase', () => {
  motion.matches = true;
  const { container } = render(<HomeHeadline onSelect={jest.fn()} />);
  expect(screen.getByRole('button')).toHaveClass('is-settled');
  expect(visibleText(container)).toBe(HEADLINE_PHRASES[0]);
  expect(jest.getTimerCount()).toBe(0);
});

test('changing motion preference settles permanently even if preference is changed back', () => {
  render(<HomeHeadline onSelect={jest.fn()} />);
  motion.matches = true;
  act(() => motion.addEventListener.mock.calls[0][1]());
  expect(screen.getByRole('button')).toHaveClass('is-settled');
  motion.matches = false;
  act(() => motion.addEventListener.mock.calls[0][1]());
  expect(screen.getByRole('button')).toHaveClass('is-settled');
});

test('a busy request settles animation immediately and never restarts', () => {
  const { rerender } = render(<HomeHeadline onSelect={jest.fn()} />);
  rerender(<HomeHeadline onSelect={jest.fn()} paused />);
  expect(screen.getByRole('button')).toHaveClass('is-settled');
  rerender(<HomeHeadline onSelect={jest.fn()} />);
  expect(screen.getByRole('button')).toHaveClass('is-settled');
});

test('a visit initially hidden pauses and reserves all complete phrases', () => {
  visibility.mockReturnValue(true);
  const { container } = render(<HomeHeadline onSelect={jest.fn()} />);
  expect(screen.getByRole('button')).toHaveClass('is-hidden');
  const measurements = [...container.querySelectorAll('.headline-phrase-measure')];
  expect(measurements.map(node => node.textContent)).toEqual(HEADLINE_PHRASES);
  measurements.forEach(node => expect(node).toHaveAttribute('aria-hidden', 'true'));
});

test('the reveal always settles completely even when CSS animation completion is lost', () => {
  const { container } = render(<HomeHeadline onSelect={jest.fn()} />);
  const nodes = [...container.querySelectorAll('.headline-character')];
  advance(2000);
  expect(screen.getByRole('button')).toHaveClass('is-settled');
  expect([...container.querySelectorAll('.headline-character')]).toEqual(nodes);
});

test('an explicit request interaction settles without a native input event', () => {
  const { rerender } = render(<HomeHeadline onSelect={jest.fn()} interactionVersion={0} />);
  expect(screen.getByRole('button')).not.toHaveClass('is-settled');
  rerender(<HomeHeadline onSelect={jest.fn()} interactionVersion={1} />);
  expect(screen.getByRole('button')).toHaveClass('is-settled');
});


test('CSS completion settles immediately and cancels the fallback timer', () => {
  const { container } = render(<HomeHeadline onSelect={jest.fn()} />);
  const characters = container.querySelectorAll('.headline-character');
  fireEvent.animationEnd(characters[characters.length - 1]);
  expect(screen.getByRole('button')).toHaveClass('is-settled');
  expect(jest.getTimerCount()).toBe(0);
});

test('hidden then visible, focus and blur, and repeated clicks cannot restart a completed phrase', () => {
  const select = jest.fn();
  const { unmount } = render(<HomeHeadline onSelect={select} />);
  const button = screen.getByRole('button');
  visibility.mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  advance(2000);
  visibility.mockReturnValue(false);
  fireEvent(document, new Event('visibilitychange'));
  fireEvent.focus(button);
  fireEvent.blur(button);
  fireEvent.click(button);
  fireEvent.click(button);
  expect(button).toHaveClass('is-settled');
  expect(select).toHaveBeenCalledTimes(2);
  expect(jest.getTimerCount()).toBe(0);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});

test('busy state blocks example replacement and becomes usable after loading ends', () => {
  const select = jest.fn();
  const { rerender } = render(<HomeHeadline onSelect={select} paused />);
  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(select).not.toHaveBeenCalled();
  rerender(<HomeHeadline onSelect={select} />);
  expect(button).not.toBeDisabled();
  expect(button).toHaveClass('is-settled');
  fireEvent.click(button);
  expect(select).toHaveBeenCalledTimes(1);
});

test('navigation remount gets a fresh reveal and clears the previous completion timer', () => {
  const first = render(<HomeHeadline onSelect={jest.fn()} interactionVersion={5} />);
  advance(400);
  first.unmount();
  expect(jest.getTimerCount()).toBe(0);
  const second = render(<HomeHeadline onSelect={jest.fn()} interactionVersion={5} />);
  expect(screen.getByRole('button')).not.toHaveClass('is-settled');
  advance(2000);
  expect(screen.getByRole('button')).toHaveClass('is-settled');
  second.unmount();
  expect(jest.getTimerCount()).toBe(0);
});


test('clicking during the reveal selects the entire phrase and cancels pending animation work', () => {
  const select = jest.fn();
  render(<HomeHeadline onSelect={select} />);
  advance(200);
  const button = screen.getByRole('button');
  expect(button).not.toHaveClass('is-settled');
  fireEvent.click(button);
  expect(select).toHaveBeenCalledWith(headlineRequest(HEADLINE_PHRASES[0]));
  expect(button).toHaveClass('is-settled');
  expect(jest.getTimerCount()).toBe(0);
  advance(2000);
  expect(select).toHaveBeenCalledTimes(1);
});
