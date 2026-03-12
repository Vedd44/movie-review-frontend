const normalizeText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value = "") => normalizeText(value).split(" ").filter(Boolean);

export const getMovieSignalScore = (movie = {}, options = {}) => {
  const popularity = Number(movie.popularity || 0);
  const voteCount = Number(movie.vote_count || 0);
  const voteAverage = Number(movie.vote_average || 0);
  const hasPoster = Boolean(movie.poster_path);
  const releaseDate = movie.release_date ? new Date(movie.release_date) : null;
  const now = new Date();
  const sourceBonus = options.sourceType === "now_playing" || options.sourceType === "upcoming" ? 8 : 0;
  const posterBonus = hasPoster ? 4 : -8;
  const recencyBonus = releaseDate instanceof Date && !Number.isNaN(releaseDate.getTime())
    ? Math.max(-4, 6 - Math.abs(now.getFullYear() - releaseDate.getFullYear()) * 1.25)
    : 0;

  return popularity * 0.45 + voteCount * 0.25 + voteAverage * 0.2 + sourceBonus + posterBonus + recencyBonus;
};

export const passesSignalFloor = (movie = {}, options = {}) => {
  if (!movie?.id || movie.adult) {
    return false;
  }

  if (options.allowReleaseSource && (options.sourceType === "now_playing" || options.sourceType === "upcoming")) {
    return Boolean(movie.poster_path);
  }

  return Boolean(movie.poster_path) && getMovieSignalScore(movie, options) >= (options.threshold ?? 12);
};

const getTitleSimilarityScore = (query, title) => {
  const normalizedQuery = normalizeText(query);
  const normalizedTitle = normalizeText(title);

  if (!normalizedQuery || !normalizedTitle) {
    return 0;
  }

  if (normalizedQuery === normalizedTitle) {
    return 100;
  }

  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 70;
  }

  if (normalizedTitle.includes(normalizedQuery)) {
    return 48;
  }

  const queryTokens = tokenize(query);
  const titleTokens = tokenize(title);
  const overlapCount = queryTokens.filter((token) => titleTokens.includes(token)).length;

  if (!overlapCount) {
    return 0;
  }

  return (overlapCount / Math.max(queryTokens.length, titleTokens.length)) * 40;
};

export const rankSearchResults = (query = "", movies = []) => {
  const ranked = (Array.isArray(movies) ? movies : [])
    .map((movie) => {
      const titleScore = getTitleSimilarityScore(query, movie.title);
      const signalScore = getMovieSignalScore(movie, { sourceType: "search" });
      const hasPoster = Boolean(movie.poster_path);
      const exactMatch = normalizeText(query) === normalizeText(movie.title);
      const relevanceScore = titleScore + signalScore + (hasPoster ? 10 : -18) + (exactMatch ? 60 : 0);

      return {
        ...movie,
        search_score: relevanceScore,
        signal_score: Number(signalScore.toFixed(1)),
        exact_match: exactMatch,
      };
    })
    .filter((movie) => movie.exact_match || movie.search_score >= 18 || (movie.poster_path && movie.search_score >= 10))
    .sort((left, right) => right.search_score - left.search_score);

  return ranked;
};
