const includesAnyGenre = (genres = [], values = []) => values.some((value) => genres.includes(value));

const normalizeText = (value = "") => String(value || "").trim().toLowerCase();
const trimDisplayText = (value = "", maxLength = 40) => {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ");

  if (!cleaned) {
    return "";
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
};

const formatPromptReference = (value = "") => {
  const trimmed = trimDisplayText(value, 48);
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/\.$/, "");
  return normalized.charAt(0).toLowerCase() + normalized.slice(1);
};

const getPrimaryGenre = (genres = []) => genres[0] || "movies like this";

const getToneLabel = (genres = []) => {
  if (includesAnyGenre(genres, ["Comedy", "Animation", "Family", "Music"])) return "Light";
  if (includesAnyGenre(genres, ["Horror", "Thriller", "Crime", "War"])) return "Intense";
  if (includesAnyGenre(genres, ["Drama", "History", "Romance"])) return "Emotional";
  if (includesAnyGenre(genres, ["Action", "Adventure", "Sci-Fi", "Fantasy"])) return "Big-energy";
  return "Steady";
};

const getAttentionLabel = (genres = [], runtime = 0) => {
  if (runtime >= 145 || includesAnyGenre(genres, ["Drama", "History", "War", "Mystery"])) return "High";
  if (runtime > 0 && runtime <= 105) return "Easy";
  if (includesAnyGenre(genres, ["Comedy", "Animation", "Family"])) return "Easy";
  return "Medium";
};

const getEmotionalWeightLabel = (genres = []) => {
  if (includesAnyGenre(genres, ["Comedy", "Animation", "Family", "Adventure", "Music"])) return "Light";
  if (includesAnyGenre(genres, ["Drama", "War", "History", "Horror", "Crime"])) return "Heavy";
  return "Balanced";
};

const getPaceLabel = (genres = [], runtime = 0) => {
  if (includesAnyGenre(genres, ["Action", "Adventure", "Thriller", "Horror"])) return "Fast";
  if (runtime >= 145 || includesAnyGenre(genres, ["Drama", "History"])) return "Slow";
  return "Steady";
};

const getBestWithLabel = (genres = []) => {
  if (includesAnyGenre(genres, ["Family", "Animation"])) return "Family";
  if (includesAnyGenre(genres, ["Comedy", "Action", "Adventure", "Horror"])) return "Friends";
  return "Solo";
};

const getCommitmentLabel = (attention = "Medium", emotionalWeight = "Balanced", runtime = 0) => {
  if (attention === "High" || emotionalWeight === "Heavy" || runtime >= 150) return "high";
  if (attention === "Easy" && emotionalWeight === "Light" && runtime > 0 && runtime <= 110) return "low";
  return "medium";
};

const getEnergyLabel = (pace = "Steady", attention = "Medium") => {
  if (pace === "Fast") return "high";
  if (pace === "Slow" || attention === "Easy") return "low";
  return "medium";
};

const getContentSensitivity = (genres = []) => ({
  horror: includesAnyGenre(genres, ["Horror"]),
  violence: includesAnyGenre(genres, ["Action", "Thriller", "Crime", "War", "Horror"]),
  heavy: includesAnyGenre(genres, ["Drama", "War", "History", "Crime", "Horror"]),
});

const deriveMovieAttributes = (movie = {}) => {
  const safeMovie = movie && typeof movie === "object" ? movie : {};
  const genres = Array.isArray(safeMovie.genre_names) ? safeMovie.genre_names : [];
  const runtime = Number(safeMovie.runtime || 0);
  const attention = getAttentionLabel(genres, runtime);
  const emotionalWeight = getEmotionalWeightLabel(genres);
  const pace = getPaceLabel(genres, runtime);
  const bestWith = getBestWithLabel(genres);
  const tone = getToneLabel(genres);
  const commitment = getCommitmentLabel(attention, emotionalWeight, runtime);
  const energyLevel = getEnergyLabel(pace, attention);

  return {
    tone,
    attention,
    emotionalWeight,
    pace,
    bestWith,
    runtime,
    commitment,
    energyLevel,
    genre: getPrimaryGenre(genres),
    audienceSuitability: [bestWith.toLowerCase()],
    contentSensitivity: getContentSensitivity(genres),
  };
};

const compareIntentToMovie = (intent = {}, attributes = {}) => {
  let score = 0;
  let hardConflict = false;
  const prompt = normalizeText(intent.raw_prompt || intent.prompt || "");

  if (intent.audience?.primary === "young_child" || intent.audience?.primary === "child" || intent.audience?.primary === "family") {
    if (attributes.bestWith === "Family") {
      score += 4;
    } else {
      score -= 3;
    }

    if (attributes.contentSensitivity.horror || attributes.contentSensitivity.violence || attributes.emotionalWeight === "Heavy") {
      hardConflict = true;
    }
  }

  if (intent.audience?.primary === "solo" && attributes.bestWith === "Solo") {
    score += 2;
  }

  if ((intent.watch_context || []).includes("comfort_watch") || (intent.watch_context || []).includes("sick_day")) {
    if (attributes.tone === "Light" && attributes.commitment !== "high" && !attributes.contentSensitivity.horror) {
      score += 3;
    } else {
      score -= 3;
    }
  }

  if (intent.energy_level === "low") {
    if (attributes.energyLevel === "low" || attributes.energyLevel === "medium") score += 2;
    if (attributes.energyLevel === "high") score -= 2;
  }

  if (intent.energy_level === "high") {
    if (attributes.energyLevel === "high") score += 2;
    if (attributes.energyLevel === "low") score -= 1;
  }

  if (intent.emotional_weight === "light") {
    if (attributes.emotionalWeight === "Light") score += 2;
    if (attributes.emotionalWeight === "Heavy") score -= 3;
  }

  if ((intent.avoidance_signals || []).includes("horror") && attributes.contentSensitivity.horror) {
    hardConflict = true;
  }

  if (((intent.avoidance_signals || []).includes("violence") || prompt.includes("not intense")) && attributes.contentSensitivity.violence) {
    score -= 3;
  }

  if (((intent.avoidance_signals || []).includes("heavy_emotion") || prompt.includes("not depressing")) && attributes.emotionalWeight === "Heavy") {
    score -= 3;
  }

  if ((intent.tone || []).includes("funny") && attributes.tone === "Light") score += 2;
  if ((intent.tone || []).includes("dark") && attributes.tone === "Intense") score += 2;
  if ((intent.tone || []).includes("emotional") && attributes.emotionalWeight !== "Light") score += 1;
  if ((intent.tone || []).includes("tense") && attributes.pace === "Fast") score += 1;

  return { score, hardConflict };
};

const buildContextualVerdict = (intent = {}, attributes = {}) => {
  const comparison = compareIntentToMovie(intent, attributes);

  if (comparison.hardConflict) {
    return {
      title: "Not a great fit right now",
      supportingLine: "Leans more intense and less family-safe than what you asked for",
    };
  }

  if (comparison.score >= 4) {
    return {
      title: "Right in line with your vibe",
      supportingLine: "Light, easy watch that fits your current vibe.",
    };
  }

  if (comparison.score >= 1) {
    return {
      title: "Could work depending on your mood",
      supportingLine: `${attributes.tone}, ${attributes.pace.toLowerCase()} watch that partly matches your ask but may land heavier or more specific than expected`,
    };
  }

  return {
    title: "Not a great fit right now",
    supportingLine: `${attributes.tone}, ${attributes.commitment}-commitment watch that drifts away from the tone or energy you asked for`,
  };
};

const buildExplanationVerdict = (attributes = {}, promptReference = "") => {
  const framedPrompt = formatPromptReference(promptReference);
  const promptClause = framedPrompt ? ` for the ${framedPrompt} vibe you asked for` : " for the vibe ReelBot picked around";

  return {
    title: "Why this fits your vibe",
    supportingLine: `${attributes.tone}, ${attributes.pace.toLowerCase()} watch with ${attributes.emotionalWeight.toLowerCase()} emotional weight that lines up${promptClause}.`,
  };
};

// Genre and runtime alone are not reliable enough to present pace, attention,
// intensity, or group-fit as factual movie attributes.
const buildDecisionSnapshotItems = () => [];

const buildDetailVerdict = ({ movie, recommendationContext = null }) => {
  const attributes = deriveMovieAttributes(movie);
  const intent = recommendationContext?.intent || null;
  const prompt = normalizeText(recommendationContext?.prompt || "");
  const promptReference = trimDisplayText(recommendationContext?.prompt || "");
  const recommendationSource = String(recommendationContext?.source || "").trim().toLowerCase();

  if (recommendationSource === "reelbot_pick") {
    const explanation = buildExplanationVerdict(attributes, recommendationContext?.prompt || "");
    return {
      mode: "explanation",
      label: "Based on your vibe",
      contextReference: promptReference ? `Based on: ${promptReference}` : "",
      title: explanation.title,
      supportingLine: explanation.supportingLine,
      snapshotItems: buildDecisionSnapshotItems(attributes),
      attributes,
    };
  }

  if (intent && prompt && promptReference) {
    const contextual = buildContextualVerdict(intent, attributes);
    return {
      mode: "guided",
      label: "Based on your vibe",
      contextReference: `Based on: ${promptReference}`,
      title: contextual.title,
      supportingLine: contextual.supportingLine,
      snapshotItems: buildDecisionSnapshotItems(attributes),
      attributes,
    };
  }

  return {
    mode: "default",
    label: "",
    contextReference: "",
    title: "Is this worth watching?",
    supportingLine: "Ask about tone, pacing, content, or whether it fits tonight.",
    snapshotItems: buildDecisionSnapshotItems(attributes),
    attributes,
  };
};

const GENRE_NAMES_BY_ID = {
  12: "adventure", 16: "animation", 18: "drama", 28: "action", 35: "comedy",
  80: "crime", 878: "science fiction", 9648: "mystery", 10749: "romance",
  10751: "family", 10752: "war",
};

const getNumberSignal = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const joinNatural = (parts = []) => parts.length <= 1 ? (parts[0] || "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

const buildWatchProfile = (movie = {}) => {
  const safeMovie = movie && typeof movie === "object" ? movie : {};
  const genres = Array.isArray(safeMovie.genre_names) ? safeMovie.genre_names : [];
  const genreSet = new Set(genres);
  const runtime = getNumberSignal(safeMovie.runtime);
  const content = safeMovie.content_signals || {};
  const audience = safeMovie.audience_signals || {};
  const watch = safeMovie.watch_signals || {};
  const searchableText = [safeMovie.description, safeMovie.tagline, ...(safeMovie.keyword_names || [])].join(" ").toLowerCase();
  const peril = getNumberSignal(content.peril);
  const scariness = getNumberSignal(content.scariness);
  const stimulation = getNumberSignal(content.stimulation_level, 0.35);
  const emotionalIntensity = getNumberSignal(content.emotional_intensity, 0.35);
  const kidFriendliness = getNumberSignal(audience.kid_friendliness, 0.45);
  const consensus = getNumberSignal(audience.consensus_friendliness, 0.35);
  const warmth = getNumberSignal(watch.warmth_score, 0.22);
  const practicalFit = new Set(Array.isArray(watch.practical_watch_fit) ? watch.practical_watch_fit : []);
  const hasIntensitySignals = [content.peril, content.scariness, content.stimulation_level]
    .every((value) => Number.isFinite(Number(value)));
  const isFamily = genreSet.has("Family") || genreSet.has("Animation") || kidFriendliness >= 0.68;
  const isRomanticComedy = genreSet.has("Romance") && genreSet.has("Comedy");
  const isIdeaDriven = /hacker|technology|social media|legal drama|biograph|based on true story|journalis|politic|business|inventor|scientist/.test(searchableText);
  const isHighThreat = peril >= 0.58 || scariness >= 0.55;
  const isLowStress = hasIntensitySignals && peril <= 0.18 && scariness <= 0.18 && stimulation <= 0.4;
  const runtimePhrase = runtime ? `, running ${runtime} minutes` : "";

  if (isFamily && isLowStress) {
    return {
      lane: "family",
      assessment: `A gentle, low-stress family watch with ${consensus >= 0.64 ? "broad group appeal" : "an easygoing tone"}${runtimePhrase}.`,
      goodFit: "You want an easy shared watch with comedy and room for younger viewers.",
      maybeNot: "You want adult-scale stakes, sharper tension, or something more demanding tonight.",
    };
  }

  if (isRomanticComedy && isLowStress) {
    return {
      lane: "romantic_comedy",
      assessment: `A relaxed, low-stress romantic comedy with ${emotionalIntensity >= 0.36 ? "some emotional pull" : "a light emotional touch"}${runtimePhrase}.`,
      goodFit: "You want romance and humor in a low-intensity watch that fits comfortably into an evening.",
      maybeNot: "You want suspense, spectacle, or a more plot-driven movie tonight.",
    };
  }

  if (isIdeaDriven && genreSet.has("Drama")) {
    return {
      lane: "idea_driven",
      assessment: `A focused, idea-driven drama with low physical intensity${runtimePhrase}.`,
      goodFit: "You want sharp interpersonal conflict built around ambition, ideas, and real-world consequences.",
      maybeNot: warmth <= 0.3
        ? "You want warmth, escapism, or something comfortable for distracted viewing."
        : "You want escapism or something comfortable for distracted viewing.",
    };
  }

  if (isHighThreat && (genreSet.has("Action") || genreSet.has("Thriller") || genreSet.has("Science Fiction"))) {
    return {
      lane: "high_intensity",
      assessment: `A high-intensity ${genreSet.has("Science Fiction") ? "science-fiction action" : "action-thriller"} watch built around sustained peril${runtimePhrase}.`,
      goodFit: "You want sustained suspense and large-scale action, and you are comfortable with horror-level threat.",
      maybeNot: "You need something calm, family-friendly, or easy to dip in and out of tonight.",
    };
  }

  if (genreSet.has("Comedy") && isLowStress) {
    return {
      lane: "comedy",
      assessment: `A low-stress comedy with an easygoing viewing rhythm${runtimePhrase}.`,
      goodFit: "You want humor without a demanding or high-pressure watch.",
      maybeNot: "You want heavier stakes, sustained suspense, or a more intense experience.",
    };
  }

  const genreLabel = genres.slice(0, 2).join(" and ").toLowerCase() || "movie";
  return {
    lane: "fallback",
    assessment: `A ${stimulation >= 0.55 ? "high-energy" : stimulation <= 0.32 ? "measured" : "moderate-intensity"} ${genreLabel} watch${runtimePhrase}.`,
    goodFit: practicalFit.has("full_attention")
      ? "You want a movie to actively settle into and give your full attention."
      : `You are in the mood for ${genreLabel} at this level of intensity.`,
    maybeNot: runtime >= 145
      ? `You need a short commitment; this runs ${runtime} minutes.`
      : emotionalIntensity >= 0.58
        ? "You need something emotionally light or easy to leave in the background."
        : `You want a different mood or energy level from a ${genreLabel} watch.`,
  };
};

const buildIntentMatchClauses = (movie = {}, intent = {}, profile = {}) => {
  const clauses = [];
  const runtime = getNumberSignal(movie.runtime);
  const content = movie.content_signals || {};
  const audience = movie.audience_signals || {};
  const tone = new Set([...(intent.tone || []), ...(intent.tone_preferences || [])]);
  const rubricKeys = new Set(intent.rubric_keys || []);
  const maxRuntime = getNumberSignal(intent.runtime_commitment?.max_runtime_minutes || intent.runtime_commitment?.soft_target_minutes);
  const wantsShort = rubricKeys.has("under_two_hours") || intent.constraints?.under_two_hours || intent.runtime_commitment?.preference === "short";

  if (runtime && ((maxRuntime && runtime <= maxRuntime) || (wantsShort && runtime <= 120))) {
    clauses.push(`its ${runtime}-minute runtime meets your shorter-watch constraint`);
  }
  if (["toddler", "preschool", "young_kids", "broad_family"].includes(intent.audience_age) && getNumberSignal(audience.kid_friendliness) >= 0.68) {
    clauses.push("its low-intensity family fit matches the audience you specified");
  }
  if ((tone.has("comforting") || tone.has("gentle") || tone.has("cozy") || intent.emotional_tolerance?.low_stress) && getNumberSignal(content.peril) <= 0.18) {
    clauses.push("its low-peril tone matches your request for something gentle");
  }
  if ((tone.has("tense") || tone.has("dark")) && getNumberSignal(content.peril) >= 0.45) {
    clauses.push("its sustained tension matches the darker, tenser lane you asked for");
  }
  if ((tone.has("idea-driven") || rubricKeys.has("smart_twisty")) && profile.lane === "idea_driven") {
    clauses.push("its idea-driven conflict fits the smarter watch you requested");
  }
  if (tone.has("funny") && (movie.genre_names || []).includes("Comedy")) {
    clauses.push("its comedy directly matches the lighter, funnier tone you requested");
  }
  if (intent.pacing_energy?.not_exhausting && getNumberSignal(content.stimulation_level, 0.35) <= 0.4) {
    clauses.push("its measured energy stays within your not-too-exhausting preference");
  }
  if (clauses.length < 2 && Array.isArray(intent.preferred_genre_ids)) {
    const movieGenreIds = new Set((movie.genres || []).map((genre) => Number(genre?.id)).filter(Boolean));
    const matchedGenres = intent.preferred_genre_ids.filter((genreId) => movieGenreIds.has(Number(genreId))).map((genreId) => GENRE_NAMES_BY_ID[genreId]).filter(Boolean);
    if (matchedGenres.length) clauses.push(`its ${joinNatural(matchedGenres.slice(0, 2))} lane matches your genre preference`);
  }

  return clauses.slice(0, 2);
};

const buildReelbotTake = ({ movie, recommendationContext = null }) => {
  const profile = buildWatchProfile(movie);
  const hasReliableProvenance = Boolean(
    recommendationContext?.source === "reelbot_pick"
    && recommendationContext?.intent
    && String(recommendationContext?.prompt || "").trim()
  );
  const intentMatches = hasReliableProvenance ? buildIntentMatchClauses(movie, recommendationContext.intent, profile) : [];
  const assessment = hasReliableProvenance
    ? intentMatches.length
      ? `ReelBot picked ${movie?.title || "this movie"} because ${joinNatural(intentMatches)}. ${profile.assessment}`
      : `ReelBot matched ${movie?.title || "this movie"} to “${trimDisplayText(recommendationContext.prompt, 72)}.” ${profile.assessment}`
    : profile.assessment;

  return {
    heading: hasReliableProvenance ? "Why ReelBot Picked This" : "ReelBot’s Take",
    hasReliableProvenance,
    assessment,
    goodFit: profile.goodFit,
    maybeNot: profile.maybeNot,
  };
};

export { deriveMovieAttributes, buildDetailVerdict, buildReelbotTake };
