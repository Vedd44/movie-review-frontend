const dedupeIds = (values = []) =>
  Array.from(new Set((Array.isArray(values) ? values : []).map((value) => Number(value)).filter(Boolean)));

const compact = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const lower = (value = "") => compact(value).toLowerCase();

const TIME_CONSTRAINT_DECADES = [
  { pattern: /\b(70s|70's|seventies|1970s|1970's)\b/i, min: 1970, max: 1979 },
  { pattern: /\b(80s|80's|eighties|1980s|1980's)\b/i, min: 1980, max: 1989 },
  { pattern: /\b(90s|90's|nineties|1990s|1990's)\b/i, min: 1990, max: 1999 },
  { pattern: /\b(2000s|2000's|aughts|noughties)\b/i, min: 2000, max: 2009 },
  { pattern: /\b(2010s|2010's|twenty ?tens)\b/i, min: 2010, max: 2019 },
];

const isSettingContext = (prompt = "", matchIndex = 0) => {
  const leadingWindow = String(prompt || "")
    .slice(Math.max(0, matchIndex - 28), matchIndex)
    .toLowerCase();

  return /(set|takes place|taking place|placed)\s+(squarely\s+|firmly\s+)?(in|during)\s+(the\s+)?$/.test(leadingWindow);
};

const parsePromptTimeConstraint = (prompt = "") => {
  const normalizedPrompt = lower(prompt);
  if (!normalizedPrompt) {
    return null;
  }

  for (const entry of TIME_CONSTRAINT_DECADES) {
    const match = entry.pattern.exec(normalizedPrompt);
    if (match && !isSettingContext(normalizedPrompt, match.index || 0)) {
      return {
        type: "decade",
        strict: true,
        range: {
          min_year: entry.min,
          max_year: entry.max,
        },
      };
    }
  }

  const yearPattern = /\b(19[0-9]{2}|20[0-9]{2})\b/g;
  let yearMatch = yearPattern.exec(normalizedPrompt);
  while (yearMatch) {
    if (!isSettingContext(normalizedPrompt, yearMatch.index || 0)) {
      const year = Number.parseInt(yearMatch[0], 10);
      return {
        type: "year",
        strict: true,
        range: {
          min_year: year,
          max_year: year,
        },
      };
    }
    yearMatch = yearPattern.exec(normalizedPrompt);
  }

  return null;
};

const getMovieReleaseYear = (movie = {}) => {
  const match = String(movie?.release_date || "").match(/(\d{4})/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
};

const getResolvedTimeConstraint = (payload = {}) => {
  const resolvedIntent = payload?.resolved_intent || {};
  const timeState = resolvedIntent.time_constraint_state || null;
  const backendConstraint = resolvedIntent.hard_filters?.time_constraint || null;
  const promptConstraint = parsePromptTimeConstraint(payload?.resolved_preferences?.prompt || "");
  const constraint = backendConstraint || promptConstraint;

  if (!constraint?.range && !timeState?.range && !timeState?.original_range) {
    return null;
  }

  const activeRange = timeState?.relaxed
    ? timeState.range || timeState.expanded_range || constraint?.applied_range || constraint?.relaxed_range || constraint?.range
    : timeState?.original_range || constraint?.original_range || constraint?.range || timeState?.range;

  if (!activeRange?.min_year || !activeRange?.max_year) {
    return null;
  }

  return {
    range: activeRange,
    relaxed: Boolean(timeState?.relaxed),
  };
};

const isMovieInTimeRange = (movie = {}, range = null) => {
  if (!range?.min_year || !range?.max_year) {
    return true;
  }

  const year = getMovieReleaseYear(movie);
  return Boolean(year && year >= Number(range.min_year) && year <= Number(range.max_year));
};

const isValidPickMovie = (movie, excludedIds = new Set()) =>
  Boolean(movie?.id) && Boolean(String(movie?.title || "").trim()) && !excludedIds.has(Number(movie.id));

const normalizeQueueMovies = (movies = [], excludedIds = []) => {
  const excludedIdSet = new Set(dedupeIds(excludedIds));
  const queuedIds = new Set();

  return (Array.isArray(movies) ? movies : []).filter((movie) => {
    const movieId = Number(movie?.id);
    if (!isValidPickMovie(movie, excludedIdSet) || queuedIds.has(movieId)) {
      return false;
    }

    queuedIds.add(movieId);
    return true;
  });
};

export const getPickSessionMovieIds = (entry) =>
  [entry?.primary?.id, ...((entry?.alternates || []).map((movie) => movie?.id))]
    .filter(Boolean)
    .map((value) => Number(value));

export const normalizePickPayload = (payload, excludedIds = []) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const timeConstraint = getResolvedTimeConstraint(payload);
  const rankedCandidates = normalizeQueueMovies([payload.primary, ...((Array.isArray(payload.alternates) ? payload.alternates : []))], excludedIds)
    .filter((movie) => isMovieInTimeRange(movie, timeConstraint?.range || null));

  if (!rankedCandidates.length) {
    return null;
  }

  return {
    ...payload,
    primary: rankedCandidates[0],
    alternates: rankedCandidates.slice(1),
  };
};

export const buildSwapQueueFromPayload = (payload, excludedIds = []) =>
  normalizeQueueMovies(payload?.alternates || [], [payload?.primary?.id, ...excludedIds]);

export const mergeSwapQueue = (currentQueue = [], incomingMovies = [], excludedIds = []) =>
  normalizeQueueMovies([...(Array.isArray(currentQueue) ? currentQueue : []), ...(Array.isArray(incomingMovies) ? incomingMovies : [])], excludedIds);

export const promoteQueuedPick = (pickResult, nextPrimary, remainingQueue = []) => {
  if (!pickResult?.primary || !nextPrimary?.id) {
    return pickResult;
  }

  return {
    ...pickResult,
    primary: nextPrimary,
    alternates: (Array.isArray(remainingQueue) ? remainingQueue : []).slice(0, 3),
    rationale: null,
    summary: nextPrimary.reason || pickResult.summary,
    match_score: Number(nextPrimary.match_score || pickResult.match_score || 0),
  };
};

export { dedupeIds };
