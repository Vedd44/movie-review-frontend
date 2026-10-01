import axios from "axios";
import { API_BASE_URL } from "../discovery";

const cache = new Map();
const pending = new Map();
const TTL = 30 * 60 * 1000;
const empty = (id) => ({
  id,
  watch_providers: null,
  provider_badges: [],
  availability_status: null,
});
const normalizeIds = (ids) => [
  ...new Set(
    (Array.isArray(ids) ? ids : [])
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  ),
];

export const fetchWatchProviderMap = async (movieIds = []) => {
  const ids = normalizeIds(movieIds);
  const missing = ids.filter(
    (id) =>
      !pending.has(id) &&
      (!cache.has(id) || cache.get(id).expires <= Date.now()),
  );
  // Match the API's batch limit. Concurrent consumers share requests by movie.
  for (let offset = 0; offset < missing.length; offset += 24) {
    const batch = missing.slice(offset, offset + 24);
    const request = axios
      .get(`${API_BASE_URL}/movies/watch-providers`, {
        params: { ids: batch.join(",") },
        timeout: 15000,
      })
      .then((response) => {
        const items = Array.isArray(response.data?.results)
          ? response.data.results
          : [];
        items.forEach((item) => {
          const id = Number(item?.id);
          if (!batch.includes(id)) return;
          cache.delete(id);
          cache.set(id, { item, expires: Date.now() + TTL });
        });
        while (cache.size > 500) cache.delete(cache.keys().next().value);
        // Missing items may be failed upstream requests. They remain retryable.
      })
      .finally(() => batch.forEach((id) => pending.delete(id)));
    batch.forEach((id) => pending.set(id, request));
  }
  await Promise.all([
    ...new Set(ids.map((id) => pending.get(id)).filter(Boolean)),
  ]);
  return Object.fromEntries(
    ids.map((id) => [id, cache.get(id)?.item || empty(id)]),
  );
};
