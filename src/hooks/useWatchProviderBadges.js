import { useEffect, useMemo, useState } from 'react';
import { fetchWatchProviderMap } from '../services/watchProviderService';

function useWatchProviderBadges(movieIds = []) {
  // Callers often create an ID array during render. Depend on its contents so
  // cached provider responses cannot trigger a fetch/render loop.
  const idsKey = Array.from(new Set((Array.isArray(movieIds) ? movieIds : [])
    .map((value) => Number.parseInt(value, 10)).filter((value) => value > 0)))
    .sort((left, right) => left - right).join(',');
  const normalizedIds = useMemo(
    () => idsKey ? idsKey.split(',').map(Number) : [],
    [idsKey]
  );
  const [providerMap, setProviderMap] = useState({});

  useEffect(() => {
    let cancelled = false;

    if (!normalizedIds.length) {
      setProviderMap({});
      return undefined;
    }

    fetchWatchProviderMap(normalizedIds)
      .then((nextMap) => {
        if (!cancelled) {
          setProviderMap(nextMap);
        }
      })
      .catch((error) => {
        console.error('Error fetching watch provider badges:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedIds]);

  return providerMap;
}

export default useWatchProviderBadges;
