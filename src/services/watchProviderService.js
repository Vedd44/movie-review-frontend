import axios from 'axios';
import { API_BASE_URL } from '../discovery';

const providerCache = new Map();

const normalizeIds = (movieIds = []) => Array.from(new Set((Array.isArray(movieIds) ? movieIds : []).map((value) => Number.parseInt(value, 10)).filter(Boolean)));

export const fetchWatchProviderMap = async (movieIds = []) => {
  const ids = normalizeIds(movieIds);
  const missingIds = ids.filter((id) => !providerCache.has(id));

  if (missingIds.length) {
    const response = await axios.get(`${API_BASE_URL}/movies/watch-providers`, {
      params: { ids: missingIds.join(',') },
    });

    const items = Array.isArray(response.data?.results) ? response.data.results : [];
    const returnedIds = new Set();

    items.forEach((item) => {
      if (!item?.id) {
        return;
      }
      returnedIds.add(item.id);
      providerCache.set(item.id, item);
    });

    missingIds.forEach((id) => {
      if (!returnedIds.has(id)) {
        providerCache.set(id, { id, watch_providers: null, provider_badges: [] });
      }
    });
  }

  return ids.reduce((accumulator, id) => {
    accumulator[id] = providerCache.get(id) || { id, watch_providers: null, provider_badges: [] };
    return accumulator;
  }, {});
};
