const dedupeIds = (values = []) =>
  Array.from(new Set((Array.isArray(values) ? values : []).map((value) => Number(value)).filter(Boolean)));

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

  const rankedCandidates = normalizeQueueMovies([payload.primary, ...((Array.isArray(payload.alternates) ? payload.alternates : []))], excludedIds);
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
