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

const normalizeTake = (take) => {
  if (!take || typeof take !== "object") return null;
  const assessment = String(take.assessment || "").trim();
  const goodFit = String(take.good_fit_if || take.goodFit || "").trim();
  const maybeNot = String(take.maybe_not_if || take.maybeNot || "").trim();
  return assessment && goodFit && maybeNot ? { assessment, goodFit, maybeNot } : null;
};

const buildLocalTakeFallback = (movie = {}) => {
  const title = String(movie?.title || "This movie").trim();
  const runtime = Number(movie?.runtime || 0);
  return {
    assessment: `ReelBot’s fuller viewing read for ${title} is temporarily unavailable.${runtime ? ` It runs ${runtime} minutes, so use the premise and details below to judge whether that commitment fits tonight.` : " Use the premise and details below to judge whether it fits tonight."}`,
    goodFit: "You already know the premise is the kind of experience you want tonight.",
    maybeNot: "You need a more specific read on tone, intensity, or commitment before deciding.",
  };
};

const buildRecommendationTake = (movie = {}, recommendationContext = {}) => {
  const rationale = recommendationContext.rationale || {};
  const whyRecommended = Array.isArray(rationale.whyRecommended)
    ? rationale.whyRecommended.map((line) => String(line || "").trim()).filter(Boolean)
    : [];
  const prompt = trimDisplayText(recommendationContext.prompt, 72);
  const assessment = String(rationale.decisionSentence || rationale.summaryLine || movie.reason || "").trim()
    || `ReelBot matched ${movie?.title || "this movie"} to “${prompt}.”`;
  const goodFit = whyRecommended[0]
    || String(rationale.primary_reason || rationale.contextAnchor || "").trim()
    || `It was the strongest available match for “${prompt}.”`;
  const maybeNot = whyRecommended[1]
    || String(rationale.tradeoff || rationale.maybeNot || "").trim()
    || "The match may be less useful if your priorities have changed since that request.";

  return { assessment, goodFit, maybeNot };
};

const buildReelbotTake = ({ movie, recommendationContext = null, genericTake = null }) => {
  const hasReliableProvenance = Boolean(
    recommendationContext?.source === "reelbot_pick"
    && recommendationContext?.intent
    && String(recommendationContext?.prompt || "").trim()
  );
  const content = hasReliableProvenance
    ? buildRecommendationTake(movie, recommendationContext)
    : normalizeTake(genericTake) || buildLocalTakeFallback(movie);

  return {
    heading: hasReliableProvenance ? "Why ReelBot Picked This" : "ReelBot’s Take",
    hasReliableProvenance,
    ...content,
  };
};

export { deriveMovieAttributes, buildDetailVerdict, buildReelbotTake };
