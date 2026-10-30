import { act, renderHook } from '@testing-library/react';
import useFeaturedCollections from './useFeaturedCollections';
import { OCTOBER_END } from '../featuredCollections';
import { COLLECTIONS } from '../collections';

afterEach(() => jest.useRealTimers());
test('an open tab switches to the reviewed November shelf at New York midnight', () => {
  jest.useFakeTimers().setSystemTime(OCTOBER_END - 1000);
  const { result, unmount } = renderHook(() => useFeaturedCollections(COLLECTIONS));
  expect(result.current.isOctober).toBe(true);
  act(() => jest.advanceTimersByTime(1000));
  expect(result.current.isOctober).toBe(false);
  expect(result.current.collections.map(c => c.slug)).toEqual(['best-feel-good-movies', 'great-thrillers-under-2-hours', 'animated-movies-for-adults']);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
test('rechecks the calendar when a suspended tab regains focus', () => {
  jest.useFakeTimers().setSystemTime(OCTOBER_END - 1000);
  const { result, unmount } = renderHook(() => useFeaturedCollections(COLLECTIONS));
  act(() => { jest.setSystemTime(OCTOBER_END + 1000); window.dispatchEvent(new Event('focus')); });
  expect(result.current.isOctober).toBe(false);
  expect(result.current.collections.map(c => c.slug)).toEqual(['best-feel-good-movies', 'great-thrillers-under-2-hours', 'animated-movies-for-adults']);
  unmount();
});

test('rechecks a background tab when it becomes visible after the November boundary', () => {
  jest.useFakeTimers().setSystemTime(OCTOBER_END - 1000);
  const { result, unmount } = renderHook(() => useFeaturedCollections(COLLECTIONS));
  act(() => { jest.setSystemTime(OCTOBER_END + 1000); document.dispatchEvent(new Event('visibilitychange')); });
  expect(result.current.collections.map(c => c.slug)).toEqual(['best-feel-good-movies', 'great-thrillers-under-2-hours', 'animated-movies-for-adults']);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
