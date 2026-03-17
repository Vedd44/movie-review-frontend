const includesAnyGenre = (genres = [], values = []) => values.some((value) => genres.includes(value));

const normalizeText = (value = "") => String(value || "").trim().toLowerCase();

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

const buildGenericVerdictTitle = (attributes) => {
  let score = 0;

  if (attributes.attention === "Easy") score += 2;
  if (attributes.attention === "Medium") score += 1;
  if (attributes.attention === "High") score -= 2;

  if (attributes.emotionalWeight === "Light") score += 2;
  if (attributes.emotionalWeight === "Balanced") score += 1;
  if (attributes.emotionalWeight === "Heavy") score -= 2;

  if (attributes.pace === "Fast" || attributes.pace === "Steady") score += 1;
  if (attributes.pace === "Slow") score -= 1;

  if (attributes.runtime && attributes.runtime <= 110) score += 2;
  else if (attributes.runtime && attributes.runtime <= 130) score += 1;
  else if (attributes.runtime >= 150) score -= 2;

  if (attributes.bestWith === "Family" || attributes.bestWith === "Friends") score += 1;
  if (attributes.tone === "Light") score += 1;
  if (attributes.tone === "Intense") score -= 1;

  if (score >= 6) return "Worth your time";
  if (score >= 4) return "Good casual pick";
  if (score >= 1) return "Only if you're in the mood";
  return `Skip unless you love ${attributes.genre.toLowerCase()}`;
};

const buildGenericSupportingLine = (attributes) =>
  `${attributes.tone}, ${attributes.commitment}-commitment ${attributes.bestWith.toLowerCase()} watch with ${attributes.pace.toLowerCase()} pacing`;

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

const buildDecisionSnapshotItems = (attributes = {}) => ([
  { label: "Attention", value: attributes.attention },
  { label: "Emotional Weight", value: attributes.emotionalWeight },
  { label: "Pace", value: attributes.pace },
  { label: "Best With", value: attributes.bestWith },
]);

const buildDetailVerdict = ({ movie, recommendationContext = null }) => {
  const attributes = deriveMovieAttributes(movie);
  const genericTitle = buildGenericVerdictTitle(attributes);
  const genericSupportingLine = buildGenericSupportingLine(attributes);
  const intent = recommendationContext?.intent || null;
  const prompt = normalizeText(recommendationContext?.prompt || "");

  if (intent && prompt) {
    const contextual = buildContextualVerdict(intent, attributes);
    return {
      label: "Based on your vibe:",
      title: contextual.title,
      supportingLine: contextual.supportingLine,
      snapshotItems: buildDecisionSnapshotItems(attributes),
      attributes,
    };
  }

  return {
    label: "",
    title: genericTitle,
    supportingLine: genericSupportingLine,
    snapshotItems: buildDecisionSnapshotItems(attributes),
    attributes,
  };
};

export { deriveMovieAttributes, buildDetailVerdict };
