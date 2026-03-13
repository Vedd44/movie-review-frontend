const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const truncateText = (value, maxLength = 140) => {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}…`;
};

const normalizeReason = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const isPromptEcho = (value = "") =>
  /fits? what you asked|matches? your|your vibe|you asked|because you wanted|for tonight|based on your prompt|based on what you told/i.test(value);

const hasGenres = (movie, genres = []) => {
  const genreNames = Array.isArray(movie?.genre_names) ? movie.genre_names : [];
  return genres.some((genre) => genreNames.includes(genre));
};

const includesAny = (value = "", terms = []) => terms.some((term) => value.includes(term));

const getPromptAnchorText = (prompt = "") => {
  const cleaned = truncateText(String(prompt || "").trim().replace(/^[^a-zA-Z0-9]+/, "").replace(/[.!?]+$/, ""), 64);
  if (!cleaned) {
    return "Based on the kind of movie you asked for.";
  }

  const lowered = cleaned.toLowerCase();
  if (/^(a|an|the)\b/.test(lowered)) {
    return `Because you asked for ${cleaned}.`;
  }

  if (/^(something|anything)\b/.test(lowered)) {
    return `Because you asked for ${cleaned}.`;
  }

  return `Because you asked for something ${cleaned}.`;
};

const getPromptProfile = (preferences = {}) => {
  const prompt = String(preferences.prompt || "")
    .trim()
    .toLowerCase();

  if (!prompt) {
    return null;
  }

  if (includesAny(prompt, ["visually stunning", "visual", "cinematic", "gorgeous", "beautiful shot", "stunning"])) {
    return {
      key: "visual",
      anchor: "For a visually driven watch with real cinematic pull.",
    };
  }

  if (
    (includesAny(prompt, ["tense", "thriller", "suspense", "edge of your seat"]) &&
      includesAny(prompt, ["not depressing", "not miserable", "not bleak", "not too dark", "less heavy"])) ||
    includesAny(prompt, ["tense but not depressing", "tense but not miserable"])
  ) {
    return {
      key: "tense-light",
      anchor: "For something tense without tipping all the way into bleak.",
    };
  }

  if (includesAny(prompt, ["easy watch", "easy", "light", "comfort", "relaxed", "lazy sunday", "fun"])) {
    return {
      key: "easy",
      anchor: "For an easy watch that still feels worth settling into.",
    };
  }

  if (includesAny(prompt, ["smart", "twisty", "clever", "mind-bending", "mystery", "sci-fi"])) {
    return {
      key: "smart",
      anchor: "For something smart, twisty, and easy to lock into.",
    };
  }

  if (includesAny(prompt, ["dark", "moody", "edgy", "grim", "brooding"])) {
    return {
      key: "dark",
      anchor: "For a darker, moodier watch with some edge.",
    };
  }

  if (includesAny(prompt, ["emotional", "moving", "heartfelt", "tearjerker", "romantic"])) {
    return {
      key: "emotional",
      anchor: "For something emotional that still knows how to land.",
    };
  }

  return {
    key: "custom",
    anchor: getPromptAnchorText(prompt),
  };
};

const getOverviewSummary = (movie) => {
  if (hasGenres(movie, ["Sci-Fi", "Fantasy"])) {
    return "A visually rich pick with enough momentum and scale to pull you in.";
  }

  if (hasGenres(movie, ["Thriller", "Mystery"])) {
    return "A sharper, more immersive option that keeps the tension up without turning punishing.";
  }

  if (hasGenres(movie, ["Comedy", "Animation"])) {
    return "An easy watch with enough personality to keep the night moving.";
  }

  if (hasGenres(movie, ["Drama", "Romance", "Music"])) {
    return "An emotionally grounded pick that lands without becoming too heavy.";
  }

  const overview = String(movie?.overview || "").trim();
  const firstSentence = overview.match(/[^.!?]+[.!?]/)?.[0]?.trim();
  return truncateText(firstSentence || "A confident pick with clear tone and enough pull to dive into right away.", 140);
};

const getGenreReason = (movie) => {
  if (hasGenres(movie, ["Comedy", "Animation"])) {
    return "Lighter comic energy makes it easy to settle into without much friction.";
  }

  if (hasGenres(movie, ["Action", "Adventure"])) {
    return "The pacing stays lively, so it keeps moving without feeling exhausting.";
  }

  if (hasGenres(movie, ["Thriller", "Mystery"])) {
    return "Tension gives it a steady pull without tipping all the way into misery.";
  }

  if (hasGenres(movie, ["Sci-Fi", "Fantasy"])) {
    return "Visual world-building gives it more flavor than a generic safe pick.";
  }

  if (hasGenres(movie, ["Drama", "Romance", "Music"])) {
    return "The emotional angle adds weight while still keeping the story accessible.";
  }

  return "It has a clear point of view, which makes it feel more deliberate than filler.";
};

const getRuntimeReason = (movie) => {
  const runtime = Number(movie?.runtime || 0);

  if (!runtime) {
    return null;
  }

  if (runtime <= 110) {
    return "Lean runtime keeps it easy to commit to.";
  }

  if (runtime >= 140) {
    return "The longer runtime gives the story room to really build.";
  }

  return "The runtime sits in a comfortable middle, so it has room to land without dragging.";
};

const getAudienceReason = (movie) => {
  const voteAverage = Number(movie?.vote_average || 0);
  const voteCount = Number(movie?.vote_count || 0);
  const signalScore = Number(movie?.signal_score || 0);

  if (voteAverage >= 7.4 && voteCount >= 80) {
    return "Strong audience response makes it feel like a safer yes.";
  }

  if (signalScore >= 18) {
    return "It has real momentum right now, which helps it feel like a live option instead of a random pull.";
  }

  return null;
};

const getReleaseReason = (movie) => {
  if (movie?.source_type === "now_playing") {
    return "Current theatrical momentum helps it feel timely even while audience totals are still catching up.";
  }

  if (movie?.source_type === "upcoming") {
    return "Early release buzz gives it more weight than a low-data title would usually have.";
  }

  return null;
};

const getConfidenceLabel = (score) => {
  if (score >= 89) {
    return "Strong Match";
  }

  if (score >= 81) {
    return "Great Match";
  }

  if (score >= 73) {
    return "Good Match";
  }

  return "Worth a Look";
};

const getContextAnchor = (preferences = {}, surpriseMode = false) => {
  if (surpriseMode) {
    return "A curated wildcard when you want ReelBot to surprise you.";
  }

  const promptProfile = getPromptProfile(preferences);

  if (promptProfile?.anchor) {
    return promptProfile.anchor;
  }

  if (preferences.mood && preferences.mood !== "all") {
    return "For the mood you’re in right now.";
  }

  return "A strong place to start.";
};

const getTasteCue = () => "ReelBot learns from the movies you save, skip, or mark as seen.";

export const getBackupRoleLabel = (movie, index = 0) => {
  if (movie?.backupRole) {
    return movie.backupRole;
  }

  const voteAverage = Number(movie?.vote_average || 0);
  const voteCount = Number(movie?.vote_count || 0);
  const signalScore = Number(movie?.signal_score || 0);

  if (index === 0 && (voteAverage >= 7 || voteCount >= 120 || signalScore >= 18)) {
    return "Safer pick";
  }

  if (hasGenres(movie, ["Thriller", "Horror", "Crime"])) {
    return "Darker option";
  }

  if (hasGenres(movie, ["Comedy", "Animation", "Romance"])) {
    return "Lighter pick";
  }

  if (hasGenres(movie, ["Sci-Fi", "Fantasy", "Mystery"])) {
    return "Wildcard";
  }

  if (index === 0) {
    return "Safer pick";
  }

  if (index === 1) {
    return "Wildcard";
  }

  return "Another angle";
};

export const buildRecommendationRationale = ({ pickResult, activePick, profile, surpriseMode = false }) => {
  if (!pickResult?.primary || !activePick) {
    return null;
  }

  if (pickResult?.rationale) {
    let confidenceScore = Number(pickResult.match_score || activePick.match_score || 0);
    if (!confidenceScore) {
      confidenceScore = 78;
    }

    confidenceScore = clamp(confidenceScore, 68, 97);

    return {
      title: "Your Pick",
      heading: pickResult.rationale.heading || "ReelBot’s Pick",
      contextAnchor: pickResult.rationale.contextAnchor || getContextAnchor(pickResult.resolved_preferences || {}, surpriseMode),
      whyTitle: pickResult.rationale.whyTitle || "Why ReelBot picked this",
      confidenceScore,
      confidenceLabel: getConfidenceLabel(confidenceScore),
      summaryLine: pickResult.rationale.summaryLine || getOverviewSummary(activePick),
      fitLabel: `${confidenceScore}% Match`,
      tasteCue: getTasteCue(profile),
      whyRecommended: Array.isArray(pickResult.rationale.whyRecommended) ? pickResult.rationale.whyRecommended.slice(0, 3) : [],
    };
  }

  const preferences = {
    source: "feed",
    mood: "all",
    runtime: "any",
    company: "any",
    prompt: "",
    ...(pickResult.resolved_preferences || {}),
  };

  let confidenceScore = Number(pickResult.match_score || activePick.match_score || 0);
  if (!confidenceScore) {
    confidenceScore = 72;
    if (activePick.vote_average >= 7.8) confidenceScore += 8;
    else if (activePick.vote_average >= 6.8) confidenceScore += 5;
    else if (activePick.vote_average >= 6) confidenceScore += 2;
    if (activePick.signal_score >= 18) confidenceScore += 5;
    if (activePick.source_type === "now_playing" || activePick.source_type === "upcoming") confidenceScore += 3;
  }

  confidenceScore = clamp(confidenceScore, 68, 97);

  const whyRecommended = [
    normalizeReason(activePick.reason),
    getGenreReason(activePick),
    getRuntimeReason(activePick),
    getAudienceReason(activePick),
    getReleaseReason(activePick),
  ]
    .filter(Boolean)
    .filter((reason, index, reasons) => !isPromptEcho(reason) && reasons.indexOf(reason) === index)
    .slice(0, 3);

  return {
    title: "Your Pick",
    heading: "ReelBot’s Pick",
    contextAnchor: getContextAnchor(preferences, surpriseMode),
    whyTitle: "Why ReelBot picked this",
    confidenceScore,
    confidenceLabel: getConfidenceLabel(confidenceScore),
    summaryLine: getOverviewSummary(activePick),
    fitLabel: `${confidenceScore}% Match`,
    tasteCue: getTasteCue(profile),
    whyRecommended,
  };
};
