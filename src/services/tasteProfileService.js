const STORAGE_KEY = "reelbot:taste-profile:v1";
export const TASTE_PROFILE_UPDATED_EVENT = "reelbot:taste-profile-updated";
export const SAVED_MOVIE_BUCKETS = ["watchlist", "seen", "hidden", "recent"];

const DEFAULT_PROFILE = {
  version: 3,
  watchlist: [],
  seen: [],
  skipped: [],
  likedVibes: [],
  recentMovies: [],
  recentRecommendations: [],
  pickHistory: [],
  lastPickPreferences: null,
};

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const dedupeById = (items = []) => {
  const seenIds = new Set();
  return items.filter((item) => {
    if (!item?.id || seenIds.has(item.id)) {
      return false;
    }

    seenIds.add(item.id);
    return true;
  });
};

const dedupeStrings = (values = []) => [...new Set((Array.isArray(values) ? values : []).map((value) => Number(value)).filter(Boolean))];

const normalizeMovieEntry = (movie = {}, extra = {}) => ({
  id: movie.id,
  title: movie.title || "Unknown title",
  poster_path: movie.poster_path || null,
  release_date: movie.release_date || "",
  vote_average: Number(movie.vote_average || movie.rating) || 0,
  overview: movie.overview || movie.description || "",
  saved_at: new Date().toISOString(),
  ...extra,
});

const upsertMovieEntry = (items, movie, extra = {}, maxItems = 36) => {
  if (!movie?.id) {
    return Array.isArray(items) ? items : [];
  }

  const nextItems = [normalizeMovieEntry(movie, extra), ...(Array.isArray(items) ? items : []).filter((item) => item.id !== movie.id)];
  return dedupeById(nextItems).slice(0, maxItems);
};

const normalizeLikedVibes = (likedVibes = []) =>
  (Array.isArray(likedVibes) ? likedVibes : [])
    .filter((item) => item?.key && item?.movie_id)
    .slice(0, 24);

const normalizePickHistory = (pickHistory = []) =>
  (Array.isArray(pickHistory) ? pickHistory : [])
    .filter((entry) => entry?.signature && Array.isArray(entry.movie_ids))
    .map((entry) => ({
      ...entry,
      movie_ids: dedupeStrings(entry.movie_ids).slice(0, 6),
    }))
    .filter((entry) => entry.movie_ids.length > 0)
    .slice(0, 18);

const normalizeRecentRecommendations = (recentRecommendations = []) =>
  dedupeById(Array.isArray(recentRecommendations) ? recentRecommendations : []).slice(0, 30);

const migrateProfile = (profile = {}) => ({
  ...DEFAULT_PROFILE,
  ...profile,
  version: 3,
  watchlist: dedupeById(Array.isArray(profile.watchlist) ? profile.watchlist : []),
  seen: dedupeById(Array.isArray(profile.seen) ? profile.seen : []),
  skipped: dedupeById(Array.isArray(profile.skipped) ? profile.skipped : []),
  recentMovies: dedupeById(Array.isArray(profile.recentMovies) ? profile.recentMovies : []).slice(0, 18),
  recentRecommendations: normalizeRecentRecommendations(profile.recentRecommendations),
  likedVibes: normalizeLikedVibes(profile.likedVibes),
  pickHistory: normalizePickHistory(profile.pickHistory),
  lastPickPreferences: profile.lastPickPreferences || null,
});

const persist = (profile) => {
  if (!canUseStorage()) {
    return profile;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new window.CustomEvent(TASTE_PROFILE_UPDATED_EVENT));
  return profile;
};

const load = () => {
  if (!canUseStorage()) {
    return { ...DEFAULT_PROFILE };
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return { ...DEFAULT_PROFILE };
    }

    const parsedValue = JSON.parse(rawValue);
    return migrateProfile(parsedValue);
  } catch (error) {
    console.error("Failed to load taste profile:", error);
    return { ...DEFAULT_PROFILE };
  }
};

const save = (profile) => persist(migrateProfile(profile));

const removeMovieFromBuckets = (profile, movieId) => ({
  ...profile,
  watchlist: (profile.watchlist || []).filter((item) => item.id !== movieId),
  seen: (profile.seen || []).filter((item) => item.id !== movieId),
  skipped: (profile.skipped || []).filter((item) => item.id !== movieId),
});

const toggleBucket = (profile, bucket, movie) => {
  if (!movie?.id) {
    return profile;
  }

  const bucketKey = bucket === "hidden" ? "skipped" : bucket;
  const currentItems = Array.isArray(profile[bucketKey]) ? profile[bucketKey] : [];
  const alreadyInBucket = currentItems.some((item) => item.id === movie.id);

  if (alreadyInBucket) {
    return {
      ...profile,
      [bucketKey]: currentItems.filter((item) => item.id !== movie.id),
    };
  }

  const nextProfile = removeMovieFromBuckets(profile, movie.id);
  const nextBucketItems = upsertMovieEntry(nextProfile[bucketKey], movie);

  return {
    ...nextProfile,
    [bucketKey]: nextBucketItems,
    recentMovies: bucketKey === "seen" ? upsertMovieEntry(nextProfile.recentMovies, movie, {}, 18) : nextProfile.recentMovies,
  };
};

const buildPickPreferenceSignature = (preferences = {}) => {
  const normalizedPrompt = String(preferences.prompt || "").trim().toLowerCase();
  return [
    preferences.source || "feed",
    preferences.view || "latest",
    preferences.genre || "all",
    preferences.mood || "all",
    preferences.runtime || "any",
    preferences.company || "any",
    normalizedPrompt,
  ].join("::");
};

const getMovieTasteState = (profile, movieId, vibeLabel = "") => {
  const safeProfile = profile || DEFAULT_PROFILE;
  const vibeKey = vibeLabel ? `${movieId}:${vibeLabel.toLowerCase()}` : "";

  return {
    inWatchlist: safeProfile.watchlist.some((item) => item.id === movieId),
    seen: safeProfile.seen.some((item) => item.id === movieId),
    skipped: safeProfile.skipped.some((item) => item.id === movieId),
    likedVibe: vibeKey ? safeProfile.likedVibes.some((item) => item.key === vibeKey) : false,
  };
};

const toggleWatchlist = (profile, movie) => toggleBucket(profile, "watchlist", movie);
const toggleSeen = (profile, movie) => toggleBucket(profile, "seen", movie);
const toggleSkipped = (profile, movie) => toggleBucket(profile, "hidden", movie);

const toggleLikedVibe = (profile, movie, vibeLabel) => {
  if (!movie?.id || !vibeLabel) {
    return profile;
  }

  const key = `${movie.id}:${vibeLabel.toLowerCase()}`;
  const likedVibes = Array.isArray(profile.likedVibes) ? profile.likedVibes : [];
  const alreadyLiked = likedVibes.some((item) => item.key === key);

  return {
    ...profile,
    likedVibes: alreadyLiked
      ? likedVibes.filter((item) => item.key !== key)
      : [
          {
            key,
            movie_id: movie.id,
            movie_title: movie.title || "Unknown title",
            label: vibeLabel,
            saved_at: new Date().toISOString(),
          },
          ...likedVibes,
        ].slice(0, 24),
  };
};

const addRecentMovie = (profile, movie) => ({
  ...profile,
  recentMovies: upsertMovieEntry(profile.recentMovies, movie, {}, 18),
});

const savePickPreferences = (profile, preferences) => ({
  ...profile,
  lastPickPreferences: {
    saved_at: new Date().toISOString(),
    ...preferences,
  },
});

const recordPickResult = (profile, preferences, payload) => {
  const movieIds = dedupeStrings([
    payload?.primary?.id,
    ...((payload?.alternates || []).map((movie) => movie?.id)),
  ]);
  const recommendedMovies = [payload?.primary, ...((payload?.alternates || []).filter(Boolean))].filter((movie) => movie?.id);

  if (!movieIds.length) {
    return profile;
  }

  const signature = buildPickPreferenceSignature(preferences);
  const nextEntry = {
    signature,
    saved_at: new Date().toISOString(),
    movie_ids: movieIds,
    preferences: {
      view: preferences.view || "latest",
      source: preferences.source || "feed",
      mood: preferences.mood || "all",
      runtime: preferences.runtime || "any",
      company: preferences.company || "any",
      genre: preferences.genre || "all",
      prompt: String(preferences.prompt || "").trim(),
    },
  };

  const existingHistory = Array.isArray(profile.pickHistory) ? profile.pickHistory : [];
  const nextHistory = [
    nextEntry,
    ...existingHistory.filter((entry) => {
      const sameSignature = entry.signature === signature;
      const sameMovies = JSON.stringify(entry.movie_ids || []) === JSON.stringify(movieIds);
      return !(sameSignature && sameMovies);
    }),
  ].slice(0, 18);

  const recommendationTimestamp = new Date().toISOString();
  const nextRecommendations = recommendedMovies.reduce(
    (items, movie) => upsertMovieEntry(items, movie, { recommended_at: recommendationTimestamp }, 30),
    Array.isArray(profile.recentRecommendations) ? profile.recentRecommendations : []
  );

  return {
    ...profile,
    pickHistory: nextHistory,
    recentRecommendations: nextRecommendations,
  };
};

const getPickExcludedIds = (profile, preferences, extraIds = []) => {
  const excludedIds = new Set(dedupeStrings(extraIds));
  const safeProfile = profile || DEFAULT_PROFILE;
  const signature = buildPickPreferenceSignature(preferences);

  (safeProfile.skipped || []).forEach((movie) => {
    if (movie?.id) {
      excludedIds.add(movie.id);
    }
  });

  (safeProfile.seen || []).forEach((movie) => {
    if (movie?.id) {
      excludedIds.add(movie.id);
    }
  });

  (safeProfile.recentRecommendations || []).slice(0, 24).forEach((movie) => {
    if (movie?.id) {
      excludedIds.add(movie.id);
    }
  });

  (safeProfile.pickHistory || [])
    .filter((entry) => entry.signature === signature)
    .slice(0, 4)
    .forEach((entry) => {
      (entry.movie_ids || []).forEach((movieId) => excludedIds.add(movieId));
    });

  return Array.from(excludedIds);
};

const getSavedMoviesForBucket = (profile, bucket) => {
  const safeProfile = profile || DEFAULT_PROFILE;

  if (bucket === "hidden") {
    return safeProfile.skipped || [];
  }

  if (bucket === "recent") {
    return safeProfile.recentMovies || [];
  }

  return safeProfile[bucket] || [];
};

const getSavedCounts = (profile) => {
  const safeProfile = profile || DEFAULT_PROFILE;
  return {
    watchlist: (safeProfile.watchlist || []).length,
    seen: (safeProfile.seen || []).length,
    hidden: (safeProfile.skipped || []).length,
    recent: (safeProfile.recentMovies || []).length,
  };
};

export const tasteProfileService = {
  STORAGE_KEY,
  load,
  save,
  getMovieTasteState,
  toggleWatchlist,
  toggleSeen,
  toggleSkipped,
  toggleLikedVibe,
  addRecentMovie,
  savePickPreferences,
  recordPickResult,
  getPickExcludedIds,
  getSavedMoviesForBucket,
  getSavedCounts,
  buildPickPreferenceSignature,
};
