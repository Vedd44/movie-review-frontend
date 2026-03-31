import axios from "axios";
import { API_BASE_URL, normalizeView } from "../discovery";

const HOME_FEED_CACHE_STORAGE_KEY = "reelbot:home-feed-cache:v1";
const HOME_FEED_FRESH_TTL_MS = 2 * 60 * 1000;
const HOME_FEED_STALE_TTL_MS = 20 * 60 * 1000;

const memoryCache = new Map();
const inFlightRequests = new Map();

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const buildCacheKey = (view = "latest", page = 1) => `${normalizeView(view)}::${Math.max(1, Number(page) || 1)}`;

const normalizeFeedPayload = (payload = {}, view = "latest", page = 1) => ({
  results: Array.isArray(payload.results) ? payload.results : [],
  total_pages: Number(payload.total_pages || 1),
  page: Math.max(1, Number(page) || 1),
  view: normalizeView(view),
});

const readPersistentCache = () => {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(HOME_FEED_CACHE_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
  } catch (error) {
    console.error("Failed to load homepage feed cache:", error);
    return {};
  }
};

const writePersistentCache = (entries) => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(HOME_FEED_CACHE_STORAGE_KEY, JSON.stringify(entries || {}));
  } catch (error) {
    console.error("Failed to save homepage feed cache:", error);
  }
};

const hydrateMemoryEntryFromStorage = (cacheKey) => {
  const cachedEntries = readPersistentCache();
  const storedEntry = cachedEntries[cacheKey];

  if (!storedEntry?.savedAt || !storedEntry?.payload) {
    return null;
  }

  if (Date.now() - Number(storedEntry.savedAt) > HOME_FEED_STALE_TTL_MS) {
    delete cachedEntries[cacheKey];
    writePersistentCache(cachedEntries);
    return null;
  }

  memoryCache.set(cacheKey, storedEntry);
  return storedEntry;
};

const saveFeedSnapshot = (view, page, payload) => {
  const cacheKey = buildCacheKey(view, page);
  const entry = {
    savedAt: Date.now(),
    payload: normalizeFeedPayload(payload, view, page),
  };

  memoryCache.set(cacheKey, entry);

  const cachedEntries = readPersistentCache();
  cachedEntries[cacheKey] = entry;
  writePersistentCache(cachedEntries);

  return entry.payload;
};

const getCachedFeedSnapshot = (view = "latest", page = 1) => {
  const cacheKey = buildCacheKey(view, page);
  const cachedEntry = memoryCache.get(cacheKey) || hydrateMemoryEntryFromStorage(cacheKey);

  if (!cachedEntry?.payload) {
    return null;
  }

  const ageMs = Date.now() - Number(cachedEntry.savedAt || 0);

  if (ageMs > HOME_FEED_STALE_TTL_MS) {
    memoryCache.delete(cacheKey);
    return null;
  }

  return {
    payload: cachedEntry.payload,
    isStale: ageMs > HOME_FEED_FRESH_TTL_MS,
    savedAt: cachedEntry.savedAt,
  };
};

const requestFeed = async (view = "latest", page = 1) => {
  const normalizedView = normalizeView(view);
  const normalizedPage = Math.max(1, Number(page) || 1);
  const cacheKey = buildCacheKey(normalizedView, normalizedPage);

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const requestPromise = axios
    .get(`${API_BASE_URL}/movies?type=${normalizedView}&page=${normalizedPage}&fill=1`)
    .then((response) => saveFeedSnapshot(normalizedView, normalizedPage, response.data))
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

const prefetchHomeFeed = (view = "latest", page = 1) => {
  const snapshot = getCachedFeedSnapshot(view, page);

  if (snapshot && !snapshot.isStale) {
    return Promise.resolve(snapshot.payload);
  }

  return requestFeed(view, page);
};

export const homeFeedService = {
  getCachedFeedSnapshot,
  requestFeed,
  prefetchHomeFeed,
};
