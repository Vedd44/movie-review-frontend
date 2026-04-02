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
  { pattern: /\bTMDB genre tags?\b/gi, replacement: "the overall vibe" },
  { pattern: /\bgenre tags?\b/gi, replacement: "the overall vibe" },
  { pattern: /\btags?\b/gi, replacement: "details" },
  { pattern: /\bkeyword cues?\b/gi, replacement: "story cues" },
  { pattern: /\blane\b/gi, replacement: "vibe" },
  { pattern: /matching loosely by vibe/gi, replacement: "grabbing something only vaguely similar" },
  { pattern: /stays closely tied to this request/gi, replacement: "stays close to what you asked for" },
  { pattern: /interpreted with ReelBot's stricter tone and fit rules/gi, replacement: "read with the right tone and audience in mind" },
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

  const firstSentence = text.match(/[^.!?]+[.!?]/)?.[0]?.trim() || text;
  return ensureSentence(firstSentence);
};

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

const getFitVerdict = (score) => {
  if (score >= 88) {
    return "Great fit";
  }

  if (score >= 80) {
    return "Solid pick";
  }

  if (score >= 72) {
    return "Could work";
  }

  return "Not the best match";
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

const getBackupShortLine = (movie, index = 0) => {
  const role = String(movie?.backupRole || getBackupRoleLabel(movie, index)).toLowerCase();

  if (role.includes("safer")) {
    return "Easier yes if you want something less demanding.";
  }

  if (role.includes("lighter")) {
    return "Keeps the mood breezier and easier to slip into.";
  }

  if (role.includes("darker")) {
    return "Takes the same vibe in a darker direction.";
  }

  if (role.includes("wildcard")) {
    return "A different angle that still fits the mood.";
  }

  if (role.includes("stretch")) {
    return "A slightly bolder reach that still stays in the lane.";
  }

  if (role.includes("action")) {
    return "Leans punchier if you want more movement.";
  }

  if (role.includes("demanding")) {
    return "More of a sit-down watch if you're in for it.";
  }

  return "Close to the same mood with a different flavor.";
};

export const getBackupCardMeta = (movie, index = 0) => {
  const tags = [];
  const role = String(movie?.backupRole || getBackupRoleLabel(movie, index)).toLowerCase();

  if (role.includes("safer")) tags.push("Easier");
  if (role.includes("lighter")) tags.push("Lighter");
  if (role.includes("darker")) tags.push("Darker tone");
  if (role.includes("wildcard")) tags.push("Different angle");
  if (role.includes("stretch")) tags.push("Stretch");
  if (role.includes("action")) tags.push("More action");
  if (role.includes("demanding")) tags.push("More demanding");

  if (hasGenres(movie, ["Action", "Adventure"]) && !tags.includes("More action")) {
    tags.push("More action");
  }

  if (hasGenres(movie, ["Comedy", "Animation"]) && !tags.includes("Lighter")) {
    tags.push("Lighter");
  }

  if (hasGenres(movie, ["Thriller", "Horror", "Crime"]) && !tags.includes("Darker tone")) {
    tags.push("More intense");
  }

  if (hasGenres(movie, ["Romance", "Music"]) && !tags.includes("Lighter")) {
    tags.push("Sweeter");
  }

  if (hasGenres(movie, ["Family"]) && !tags.includes("Family-friendly")) {
    tags.push("Family-friendly");
  }

  if ((movie?.runtime || 0) <= 105) {
    tags.push("Shorter");
  } else if ((movie?.runtime || 0) >= 135) {
    tags.push("Longer sit-down");
  }

  return {
    shortLine: truncateWords(getBackupShortLine(movie, index), 12),
    tags: [...new Set(tags)].slice(0, 2),
  };
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

    const decisionSentence =
      humanizeVisibleCopy(pickResult.rationale.primary_reason || activePick.reason || pickResult.rationale.summaryLine) || getDecisionFallback(activePick);

    return {
      title: "Your Pick",
      heading: pickResult.rationale.heading || "ReelBot’s Pick",
      contextAnchor: humanizeVisibleCopy(pickResult.rationale.contextAnchor || getContextAnchor(pickResult.resolved_preferences || {}, surpriseMode)),
      confidenceScore,
      confidenceLabel: getConfidenceLabel(confidenceScore),
      confidenceStars: getConfidenceStars(confidenceScore),
      summaryLine: humanizeVisibleCopy(pickResult.rationale.summaryLine || getOverviewSummary(activePick)),
      fitLabel: `${confidenceScore}% Match`,
      tasteCue: getTasteCue(profile),
      whyRecommended: Array.isArray(pickResult.rationale.whyRecommended) ? pickResult.rationale.whyRecommended.slice(0, 3) : [],
      decisionVerdict: getFitVerdict(confidenceScore),
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

  const decisionSentence = humanizeVisibleCopy(activePick.reason || whyRecommended[0] || getOverviewSummary(activePick)) || getDecisionFallback(activePick);

  return {
    title: "Your Pick",
    heading: "ReelBot’s Pick",
    contextAnchor: humanizeVisibleCopy(getContextAnchor(preferences, surpriseMode)),
    confidenceScore,
    confidenceLabel: getConfidenceLabel(confidenceScore),
    confidenceStars: getConfidenceStars(confidenceScore),
    summaryLine: humanizeVisibleCopy(getOverviewSummary(activePick)),
    fitLabel: `${confidenceScore}% Match`,
    tasteCue: getTasteCue(profile),
    whyRecommended,
    decisionVerdict: getFitVerdict(confidenceScore),
    decisionSentence,
  };
};
