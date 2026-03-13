import { useEffect, useMemo, useState } from 'react';
import { fetchWatchProviderMap } from '../services/watchProviderService';

function useWatchProviderBadges(movieIds = []) {
  const normalizedIds = useMemo(
    () => Array.from(new Set((Array.isArray(movieIds) ? movieIds : []).map((value) => Number.parseInt(value, 10)).filter(Boolean))),
    [movieIds]
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
