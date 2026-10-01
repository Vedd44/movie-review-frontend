import { renderHook, waitFor } from '@testing-library/react';
import useWatchProviderBadges from './useWatchProviderBadges';
import { fetchWatchProviderMap } from '../services/watchProviderService';

jest.mock('../services/watchProviderService');

test('empty inline ID arrays settle without repeated state updates', () => {
  let renders = 0;
  const { result } = renderHook(() => {
    renders += 1;
    return useWatchProviderBadges([]);
  });
  expect(result.current).toEqual({});
  expect(renders).toBeLessThan(4);
  expect(fetchWatchProviderMap).not.toHaveBeenCalled();
});

test('equivalent ID arrays reuse provider data instead of fetching on every render', async () => {
  fetchWatchProviderMap.mockImplementation(async () => ({ 12: { provider_badges: [] } }));
  const { result, rerender } = renderHook(({ ids }) => useWatchProviderBadges(ids), {
    initialProps: { ids: [12, 34] },
  });
  await waitFor(() => expect(result.current[12]).toBeDefined());
  rerender({ ids: [34, 12, 12] });
  expect(fetchWatchProviderMap).toHaveBeenCalledTimes(1);
});
