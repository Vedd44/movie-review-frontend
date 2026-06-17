const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const truncateText = (value, maxLength = 140) => {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}…`;
};

const normalizeReason = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const truncateWords = (value = "", maxWords = 12) => {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return `${words.slice(0, maxWords).join(" ")}…`;
};

const ensureSentence = (value = "") => {
  const text = normalizeReason(value).replace(/\s+([,.;!?])/g, "$1");
  if (!text) {
    return "";
  }

  return /[.!?]$/.test(text) ? text : `${text}.`;
};

const HUMAN_COPY_REPLACEMENTS = [
  { pattern: /\bTMDB metadata\b/gi, replacement: "what this movie is actually like" },
  { pattern: /\bmetadata\b/gi, replacement: "the movie itself" },
  { pattern: /\bTMDB genre tags?\b/gi, replacement: "the overall feel" },
  { pattern: /\bgenre tags?\b/gi, replacement: "the overall feel" },
  { pattern: /\btags?\b/gi, replacement: "details" },
  { pattern: /\bkeyword cues?\b/gi, replacement: "story cues" },
  { pattern: /matching loosely by vibe/gi, replacement: "grabbing something only vaguely similar" },
  { pattern: /stays closely tied to this request/gi, replacement: "stays close to what you asked for" },
  { pattern: /interpreted with ReelBot's stricter tone and fit rules/gi, replacement: "read with the right tone and audience in mind" },
];

const SYSTEM_REASON_PATTERNS = [
  /these picks stay close/i,
  /specific you asked for/i,
  /pushing beyond it/i,
  /matches? your/i,
  /based on your prompt/i,
  /based on what you told/i,
  /stays close to what you asked for/i,
  /specific vibe/i,
  /your lane/i,
  /stretch fit/i,
  /clear identity/i,
  /feeling generic/i,
];

const humanizeVisibleCopy = (value = "") => {
  let text = normalizeReason(value);

  HUMAN_COPY_REPLACEMENTS.forEach(({ pattern, replacement }) => {
    text = text.replace(pattern, replacement);
  });

  text = text
    .replace(/\bThis rose to the top because\b/i, "")
    .replace(/\bBecause you asked for something\b/i, "")
    .replace(/\bBecause you asked for\b/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  text = stripSystemLanguage(text);

  const firstSentence = text.match(/[^.!?]+[.!?]/)?.[0]?.trim() || text;
  return ensureSentence(firstSentence);
};

const stripSystemLanguage = (text = "") =>
  String(text || "")
    .replace(/\bthese picks stay close to the specific you asked for instead of pushing beyond it\.?\b/gi, "")
    .replace(/\bstays close to what you asked for\b/gi, "")
    .replace(/\bthe specific vibe you asked for\b/gi, "the tone")
    .replace(/\bvibe you asked for\b/gi, "the tone")
    .replace(/\bdrifting broader\b/gi, "")
    .replace(/\bdrift broader\b/gi, "")
    .replace(/\bpushing beyond it\b/gi, "")
    .replace(/\bstretch fit\b/gi, "")
    .replace(/\byour lane\b/gi, "")
    .replace(/\blane\b/gi, "")
    .replace(/\byour vibe\b/gi, "the tone")
    .replace(/\bvibe\b/gi, "tone")
    .replace(/\bclear identity\b/gi, "")
    .replace(/\bfeeling generic\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,.;:\s-]+/, "")
    .trim();

const isPromptEcho = (value = "") =>
  /fits? what you asked|matches? your|your vibe|you asked|because you wanted|based on your prompt|based on what you told/i.test(value);

const isSystemReason = (value = "") => {
  const normalized = normalizeReason(value);
  if (!normalized) {
    return true;
  }

  return SYSTEM_REASON_PATTERNS.some((pattern) => pattern.test(normalized));
};

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
    return "A more focused, immersive option that keeps the tension up without turning punishing.";
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

const getDecisionFallback = (movie) => {
  if (hasGenres(movie, ["Comedy", "Animation"])) {
    return "Easy to settle into, with a lighter tone that never gets too heavy.";
  }

  if (hasGenres(movie, ["Thriller", "Mystery"])) {
    return "Keeps things tense and engaging without feeling punishing.";
  }

  if (hasGenres(movie, ["Action", "Adventure"])) {
    return "Fast-moving and accessible, with enough momentum to keep you locked in.";
  }

  if (hasGenres(movie, ["Drama", "Romance", "Music"])) {
    return "More emotionally grounded, but still easy enough to stay with.";
  }

  return "A clear, accessible watch that knows exactly what kind of night it suits.";
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

const getConfidenceStars = (score) => {
  if (score >= 91) return "★★★★★";
  if (score >= 84) return "★★★★☆";
  if (score >= 76) return "★★★☆☆";
  if (score >= 69) return "★★☆☆☆";
  return "★☆☆☆☆";
};

const describeGenreFocus = (movie = {}) => {
  if (hasGenres(movie, ["Action", "Adventure"])) {
    return "muscular action";
  }

  if (hasGenres(movie, ["Thriller", "Mystery"])) {
    return "taut suspense";
  }

  if (hasGenres(movie, ["Comedy", "Romance"])) {
    return "playful warmth";
  }

  if (hasGenres(movie, ["Drama", "History"])) {
    return "character-driven drama";
  }

  if (hasGenres(movie, ["Science Fiction", "Fantasy"])) {
    return "lively speculative energy";
  }

  return "clear focus";
};

const describeMovieStrength = (movie = {}, timeConstraintState = null) => {
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const eraText = releaseYear ? `From ${releaseYear}` : "Rooted in the energy you asked for";
  const genreFocus = describeGenreFocus(movie);
  const runtime = Number(movie.runtime || 0);
  const pacePhrase =
    runtime && runtime < 100
      ? "keeps things tight and punchy"
      : runtime && runtime <= 130
        ? "moves at a steady, balanced pace"
        : runtime
          ? "takes a longer sit-down approach"
          : "keeps a steady pace";
  const eraNote = timeConstraintState?.label && !timeConstraintState?.relaxed
    ? `, honoring the ${timeConstraintState.label} range`
    : "";

  return `${eraText} ${genreFocus}${eraNote} that ${pacePhrase}`;
};

const describeMovieTradeoff = (movie = {}, timeConstraintState = null) => {
  if (timeConstraintState?.relaxed && timeConstraintState?.fallback_note) {
    return timeConstraintState.fallback_note;
  }

  const voteAverage = Number(movie.vote_average || 0);
  const runtime = Number(movie.runtime || 0);

  if (voteAverage && voteAverage < 6.8) {
    return "Leans on momentum more than polish";
  }

  if (runtime && runtime > 140) {
    return "Needs patience for its longer runtime";
  }

  if (hasGenres(movie, ["Action"]) && hasGenres(movie, ["Thriller"])) {
    return "Keeps tension high, even if it trades some polish for momentum";
  }

  return "";
};

const buildRecommendationSentence = ({ baseReason, movie, timeConstraintState }) => {
  const sanitized = stripSystemLanguage(humanizeVisibleCopy(baseReason || ""));
  const strength = !isSystemReason(sanitized) ? sanitized : describeMovieStrength(movie, timeConstraintState);
  const tradeoff = describeMovieTradeoff(movie, timeConstraintState);
  const sentences = [strength, tradeoff]
    .filter(Boolean)
    .map((sentence) => ensureSentence(sentence));
  return sentences.join(" ");
};

const getFitLabel = (fitTier = "strong_fit", validation = {}, timeConstraintState = null) => {
  if (timeConstraintState?.relaxed || validation?.primary_valid === false) {
    return "Fallback pick";
  }

  if (fitTier === "strong_fit" || fitTier === "exact_fit" || fitTier === "decent_fit" || fitTier === "weak_fit") {
    return "Best fit";
  }

  return "Best fit";
};

const getContextAnchor = (preferences = {}, surpriseMode = false, timeConstraintState = null) => {
  if (surpriseMode) {
    return "A curated wildcard when you want ReelBot to surprise you.";
  }

  if (timeConstraintState?.relaxed && timeConstraintState?.label) {
    return `Just outside the ${timeConstraintState.label} era, but the closest clean fit.`;
  }

  if (timeConstraintState?.label) {
    return `Stays within the ${timeConstraintState.label} era you asked for.`;
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

const createEditorialBackupLine = (movie = {}, index = 0) => {
  const focus = getBackupRoleLabel(movie, index);
  const lead = `${focus}:`;
  const detail = hasGenres(movie, ["Comedy", "Animation", "Romance", "Family"])
    ? "Cleaner tone with a lighter grip, great for easy viewing."
    : hasGenres(movie, ["Thriller", "Horror", "Crime"])
      ? "Higher stakes and tighter pacing, though it trades some polish."
      : hasGenres(movie, ["Action"])
        ? "Muscular action that keeps momentum driving."
        : hasGenres(movie, ["Drama", "History", "Music"])
          ? "Character focus that lets you lean into the performances."
          : "Takes a different tack to keep things fresh.";

  return `${lead} ${detail}`;
};

export const getBackupRoleLabel = (movie = {}, index = 0) => {
  if (hasGenres(movie, ["Comedy", "Animation", "Romance", "Family"])) {
    return "Easy watch";
  }

  if (hasGenres(movie, ["Thriller", "Horror", "Crime", "Action"]) || Number(movie.vote_average || 0) >= 7.1) {
    return index === 0 ? "If you want something stronger" : "If you want more tension";
  }

  if (hasGenres(movie, ["Drama", "History", "Music"])) {
    return "If you're in the mood for something steadier";
  }

  return "Another angle";
};

export const getBackupCardMeta = (movie, index = 0) => {
  return {
    shortLine: createEditorialBackupLine(movie, index),
  };
};

export const buildRecommendationRationale = ({ pickResult, activePick, profile, surpriseMode = false }) => {
  if (!pickResult?.primary || !activePick) {
    return null;
  }

  const timeConstraintState = pickResult.resolved_intent?.time_constraint_state || null;
  const validation = pickResult.validation || {};
  const fitTier = pickResult.fit_tier || "strong_fit";
  const fitLabelText = getFitLabel(fitTier, validation, timeConstraintState);

  if (pickResult?.rationale) {
    let confidenceScore = Number(pickResult.match_score || activePick.match_score || 0);
    if (!confidenceScore) {
      confidenceScore = 78;
    }

    confidenceScore = clamp(confidenceScore, 68, 97);

    const decisionSentence = buildRecommendationSentence({
      baseReason: pickResult.rationale.primary_reason || activePick.reason || pickResult.rationale.summaryLine,
      movie: activePick,
      timeConstraintState,
    });

    return {
      title: "Your Pick",
      heading: pickResult.rationale.heading || "ReelBot’s Pick",
      contextAnchor: humanizeVisibleCopy(
        pickResult.rationale.contextAnchor || getContextAnchor(pickResult.resolved_preferences || {}, surpriseMode, timeConstraintState)
      ),
      confidenceScore,
      confidenceLabel: getConfidenceLabel(confidenceScore),
      confidenceStars: getConfidenceStars(confidenceScore),
      summaryLine: humanizeVisibleCopy(pickResult.rationale.summaryLine || getOverviewSummary(activePick)),
      fitLabel: fitLabelText,
      tasteCue: getTasteCue(profile),
      whyRecommended: Array.isArray(pickResult.rationale.whyRecommended) ? pickResult.rationale.whyRecommended.slice(0, 3) : [],
      decisionVerdict: fitLabelText,
      decisionSentence,
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

  const decisionSentence = buildRecommendationSentence({
    baseReason: activePick.reason || whyRecommended[0] || getOverviewSummary(activePick),
    movie: activePick,
    timeConstraintState,
  });

  return {
    title: "Your Pick",
    heading: "ReelBot’s Pick",
    contextAnchor: humanizeVisibleCopy(getContextAnchor(preferences, surpriseMode, timeConstraintState)),
    confidenceScore,
    confidenceLabel: getConfidenceLabel(confidenceScore),
    confidenceStars: getConfidenceStars(confidenceScore),
    summaryLine: humanizeVisibleCopy(getOverviewSummary(activePick)),
    fitLabel: fitLabelText,
    tasteCue: getTasteCue(profile),
    whyRecommended,
    decisionVerdict: fitLabelText,
    decisionSentence,
  };
};
