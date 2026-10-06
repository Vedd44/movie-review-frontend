const MAX_STORED_GENRES = 12;
const MAX_STORED_TONES = 8;
const MAX_STORED_IDS = 36;
const MAX_STORED_INTERACTIONS = 80;

const LANE_GENRE_MAP = {
  light: [35, 10751, 16, 12, 10749],
  heavy: [18, 36, 10752, 80],
  dark: [27, 53, 80],
  funny: [35],
  emotional: [18, 10749, 10402, 16],
  easy_watch: [35, 10751, 16, 10749, 12],
  smart_twisty: [878, 9648, 53],
};

const SURFACE_MULTIPLIER = {
  tailored: 1,
  browse: 0.35,
  home: 0.25,
};

const DEFAULT_BEHAVIORAL_MEMORY = {
  preferredGenres: {},
  avoidedGenres: {},
  tonePreferences: {},
  pacePreferences: {},
  runtimePreference: {},
  interactionStats: {
    saves: 0,
    seen: 0,
    hidden: 0,
    swaps: 0,
    promptSubmissions: 0,
    picksShown: 0,
    detailViews: 0,
    providerClicks: 0,
  },
  recentPatterns: {
    genres: [],
    tones: [],
    runtime: "",
  },
  hiddenMovieIds: [],
  seenMovieIds: [],
  savedMovieIds: [],
  recentMovieIds: [],
  swapPatterns: {
    genres: {},
    tones: {},
    pace: {},
    runtime: {},
  },
  userProfile: {
    likedGenres: [],
    dislikedGenres: [],
    preferredTraits: {
      pace: [],
      tone: [],
      runtime: [],
    },
    avoidTraits: {
      pace: [],
      tone: [],
      runtime: [],
    },
    recentlyViewed: [],
    hardAvoidMovieIds: [],
  },
  updatedAt: "",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const sortEntries = (entries = {}, maxEntries = MAX_STORED_GENRES) =>
  Object.fromEntries(
    Object.entries(entries)
      .filter(([, value]) => Number(value) > 0)
      .sort((left, right) => right[1] - left[1])
      .slice(0, maxEntries)
  );

const normalizeIdList = (values = [], maxItems = MAX_STORED_IDS) =>
  Array.from(new Set((Array.isArray(values) ? values : []).map((value) => Number(value)).filter(Boolean))).slice(0, maxItems);

const addWeight = (collection, key, weight) => {
  if (!key || !Number.isFinite(weight) || weight === 0) {
    return;
  }

  collection[key] = Number((Number(collection[key] || 0) + weight).toFixed(2));
};

const getGenreIds = (movie = {}) => {
  if (Array.isArray(movie.genre_ids) && movie.genre_ids.length) {
    return normalizeIdList(movie.genre_ids, 8);
  }

  if (Array.isArray(movie.genres) && movie.genres.length) {
    return normalizeIdList(movie.genres.map((genre) => genre?.id), 8);
  }

  return [];
};

export const getRuntimeBucket = (runtime) => {
  const normalizedRuntime = Number(runtime || 0);

  if (!normalizedRuntime) {
    return "";
  }

  if (normalizedRuntime < 100) {
    return "short";
  }

  if (normalizedRuntime <= 130) {
    return "medium";
  }

  return "long";
};

export const inferMovieLanes = (movie = {}) => {
  const genreIds = getGenreIds(movie);
  return Object.entries(LANE_GENRE_MAP)
    .filter(([, mappedGenreIds]) => mappedGenreIds.some((genreId) => genreIds.includes(genreId)))
    .map(([lane]) => lane);
};

const normalizeMovieSnapshot = (movie = {}) => ({
  id: Number(movie.id || 0) || null,
  title: movie.title || "Unknown title",
  genre_ids: getGenreIds(movie),
  runtime: Number(movie.runtime || 0) || null,
  vote_average: Number(movie.vote_average || movie.rating || 0) || 0,
  popularity: Number(movie.popularity || 0) || 0,
  release_date: movie.release_date || "",
  source_type: movie.source_type || "",
});

const deriveMovieFingerprint = (movie = {}) => ({
  genreIds: getGenreIds(movie),
  toneLanes: inferMovieLanes(movie),
  paceLanes: inferMoviePace(movie),
  runtimeBucket: getRuntimeBucket(movie.runtime),
});

export const inferMoviePace = (movie = {}) => {
  const genreIds = getGenreIds(movie);
  const runtime = Number(movie.runtime || 0);

  if (genreIds.some((genreId) => [28, 12, 53].includes(genreId))) {
    return ["fast"];
  }

  if (genreIds.some((genreId) => [18, 36, 99].includes(genreId)) || runtime >= 135) {
    return ["slow"];
  }

  if (genreIds.some((genreId) => [35, 10749, 16, 10751].includes(genreId))) {
    return ["easy"];
  }

  return ["steady"];
};

// A saved title expresses interest, not enjoyment. Only repeated interest across
// distinct titles can gently influence genre ranking; never infer tone or pace.
const buildSavedInterest = (movies = []) => {
  const counts = {};
  const distinct = new Map(movies.filter(movie => movie?.id).map(movie => [Number(movie.id), movie]));
  distinct.forEach(movie => getGenreIds(movie).forEach(id => addWeight(counts, String(id), 1)));
  return Object.fromEntries(Object.entries(counts).filter(([, count]) => count >= 3)
    .map(([id, count]) => [id, Math.min(1.2, (count - 2) * 0.4)]));
};

const buildUserProfile = (memory = {}, profile = {}) => ({
  ...DEFAULT_BEHAVIORAL_MEMORY.userProfile,
  recentlyViewed: (profile.recentMovies || []).slice(0, 6).map(movie => ({id: movie.id, title: movie.title})),
  hardAvoidMovieIds: normalizeIdList(memory.hiddenMovieIds),
});

export const buildBehavioralMemory = ({ profile = {}, interactions = [] } = {}) => {
  const nextMemory = {
    ...DEFAULT_BEHAVIORAL_MEMORY,
    interactionStats: { ...DEFAULT_BEHAVIORAL_MEMORY.interactionStats },
    recentPatterns: { ...DEFAULT_BEHAVIORAL_MEMORY.recentPatterns },
    swapPatterns: {
      genres: {},
      tones: {},
      pace: {},
      runtime: {},
    },
  };

  const watchlist = Array.isArray(profile.watchlist) ? profile.watchlist : [];
  const seen = Array.isArray(profile.seen) ? profile.seen : [];
  const skipped = Array.isArray(profile.skipped) ? profile.skipped : [];
  const recentMovies = Array.isArray(profile.recentMovies) ? profile.recentMovies : [];
  const cappedInteractions = (Array.isArray(interactions) ? interactions : []).slice(0, MAX_STORED_INTERACTIONS);

  nextMemory.signalPolicyVersion = 2;
  nextMemory.preferredGenres = buildSavedInterest(watchlist);

  cappedInteractions.forEach((entry) => {
    switch (entry?.type) {
      case "save":
        nextMemory.interactionStats.saves += 1;
        break;
      case "seen":
        nextMemory.interactionStats.seen += 1;
        break;
      case "hidden":
        nextMemory.interactionStats.hidden += 1;
        break;
      case "swap_used":
        nextMemory.interactionStats.swaps += 1;
        break;
      case "detail_view":
        nextMemory.interactionStats.detailViews += 1;
        break;
      case "provider_click":
        nextMemory.interactionStats.providerClicks += 1;
        break;
      case "pick_shown":
        nextMemory.interactionStats.picksShown += 1;
        break;
      case "prompt_submitted":
        nextMemory.interactionStats.promptSubmissions += 1;
        break;
      default:
        break;
    }
  });

  nextMemory.preferredGenres = sortEntries(nextMemory.preferredGenres, MAX_STORED_GENRES);
  nextMemory.avoidedGenres = sortEntries(nextMemory.avoidedGenres, MAX_STORED_GENRES);
  nextMemory.tonePreferences = sortEntries(
    Object.fromEntries(Object.entries(nextMemory.tonePreferences).filter(([, value]) => Number(value) > 0)),
    MAX_STORED_TONES
  );
  nextMemory.pacePreferences = sortEntries(nextMemory.pacePreferences, 4);
  nextMemory.runtimePreference = sortEntries(
    Object.fromEntries(Object.entries(nextMemory.runtimePreference).filter(([, value]) => Number(value) > 0)),
    3
  );
  nextMemory.swapPatterns = {
    genres: sortEntries(nextMemory.swapPatterns.genres, 6),
    tones: sortEntries(nextMemory.swapPatterns.tones, 4),
    pace: sortEntries(nextMemory.swapPatterns.pace, 3),
    runtime: sortEntries(nextMemory.swapPatterns.runtime, 3),
  };
  // Recent browsing prevents exact repeats; it does not define taste.
  nextMemory.hiddenMovieIds = normalizeIdList(skipped.map((movie) => movie?.id));
  nextMemory.seenMovieIds = normalizeIdList(seen.map((movie) => movie?.id));
  nextMemory.watchedAt = Object.fromEntries(seen.filter((movie) => movie.watched_at).map((movie) => [movie.id, movie.watched_at]));
  nextMemory.savedMovieIds = normalizeIdList(watchlist.map((movie) => movie?.id));
  nextMemory.recentMovieIds = normalizeIdList(recentMovies.map((movie) => movie?.id));
  nextMemory.userProfile = buildUserProfile(nextMemory, profile);
  nextMemory.updatedAt = new Date().toISOString();

  return nextMemory;
};

export const hasBehavioralSignals = (memory = {}) =>
  Boolean(
    Object.keys(memory.preferredGenres || {}).length ||
    Object.keys(memory.avoidedGenres || {}).length ||
    Object.keys(memory.tonePreferences || {}).length ||
    Object.keys(memory.pacePreferences || {}).length ||
    Object.keys(memory.runtimePreference || {}).length ||
    (memory.hiddenMovieIds || []).length ||
    (memory.seenMovieIds || []).length
  );

export const scoreMovieForBehavioralMemory = (movie = {}, memory = {}, options = {}) => {
  const surface = options.surface || "tailored";
  const multiplier = SURFACE_MULTIPLIER[surface] || SURFACE_MULTIPLIER.tailored;
  const hiddenIds = new Set(normalizeIdList(memory.hiddenMovieIds));
  const seenIds = new Set(normalizeIdList(memory.seenMovieIds));
  const recentIds = new Set(normalizeIdList(memory.recentMovieIds));
  const movieId = Number(movie?.id || 0);

  if (hiddenIds.has(movieId)) {
    return { score: -1000, reasons: ["hard_excluded"] };
  }

  const fingerprint = deriveMovieFingerprint(movie);
  const reasons = [];
  let score = 0;

  fingerprint.genreIds.forEach((genreId) => {
    const preferredWeight = Number(memory.preferredGenres?.[genreId] || 0);
    const avoidedWeight = Number(memory.avoidedGenres?.[genreId] || 0);
    const swapWeight = Number(memory.swapPatterns?.genres?.[genreId] || 0);

    if (preferredWeight) {
      score += preferredWeight * 0.95;
      reasons.push(`genre+${genreId}`);
    }

    if (avoidedWeight) {
      score -= avoidedWeight * 1.05;
      reasons.push(`genre-${genreId}`);
    }

    if (swapWeight) {
      score -= swapWeight * 0.8;
      reasons.push(`swap-genre-${genreId}`);
    }
  });

  fingerprint.toneLanes.forEach((lane) => {
    const toneWeight = Number(memory.tonePreferences?.[lane] || 0);
    const swapWeight = Number(memory.swapPatterns?.tones?.[lane] || 0);

    if (toneWeight) {
      score += toneWeight * 1.2;
      reasons.push(`tone+${lane}`);
    }

    if (swapWeight) {
      score -= swapWeight * 0.7;
      reasons.push(`swap-tone-${lane}`);
    }
  });

  fingerprint.paceLanes.forEach((lane) => {
    const paceWeight = Number(memory.pacePreferences?.[lane] || 0);
    const swapWeight = Number(memory.swapPatterns?.pace?.[lane] || 0);

    if (paceWeight) {
      score += paceWeight * 1.1;
      reasons.push(`pace+${lane}`);
    }

    if (swapWeight) {
      score -= swapWeight * 0.65;
      reasons.push(`swap-pace-${lane}`);
    }
  });

  if (fingerprint.runtimeBucket) {
    const runtimeWeight = Number(memory.runtimePreference?.[fingerprint.runtimeBucket] || 0);
    const runtimeSwapWeight = Number(memory.swapPatterns?.runtime?.[fingerprint.runtimeBucket] || 0);

    if (runtimeWeight) {
      score += runtimeWeight * 0.8;
      reasons.push(`runtime+${fingerprint.runtimeBucket}`);
    }

    if (runtimeSwapWeight) {
      score -= runtimeSwapWeight * 0.6;
      reasons.push(`swap-runtime-${fingerprint.runtimeBucket}`);
    }
  }

  if (memory.recentPatterns?.genres?.some((genreId) => fingerprint.genreIds.includes(Number(genreId)))) {
    score += 1.6;
    reasons.push("recent-genre");
  }

  if (memory.recentPatterns?.tones?.some((lane) => fingerprint.toneLanes.includes(lane))) {
    score += 1.9;
    reasons.push("recent-tone");
  }

  if (memory.recentPatterns?.runtime && memory.recentPatterns.runtime === fingerprint.runtimeBucket) {
    score += 1.1;
    reasons.push("recent-runtime");
  }

  if (seenIds.has(movieId)) {
    score -= 4;
    reasons.push("seen-deprioritized");
  }

  if (recentIds.has(movieId) && !seenIds.has(movieId)) {
    score -= 7;
    reasons.push("recent-deprioritized");
  }

  return {
    score: clamp(Number((score * multiplier).toFixed(2)), -18, 3),
    reasons,
  };
};

export const createInteractionEntry = (type, movie = null, metadata = {}) => ({
  type,
  timestamp: new Date().toISOString(),
  movie: movie?.id ? normalizeMovieSnapshot(movie) : null,
  metadata,
});

export const normalizeInteractions = (entries = []) =>
  (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.type && entry?.timestamp)
    .map((entry) => ({
      ...entry,
      movie: entry.movie?.id ? normalizeMovieSnapshot(entry.movie) : null,
      metadata: entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {},
    }))
    .slice(0, MAX_STORED_INTERACTIONS);

export const DEFAULT_TASTE_MEMORY = DEFAULT_BEHAVIORAL_MEMORY;
