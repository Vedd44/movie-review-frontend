export const ASK_INTENTS = Object.freeze({
  CURRENT_MOVIE_QUESTION: "CURRENT_MOVIE_QUESTION",
  MOVIE_RECOMMENDATION: "MOVIE_RECOMMENDATION",
  MOVIE_COMPARISON: "MOVIE_COMPARISON",
  CURRENT_SET_RECOMMENDATION: "CURRENT_SET_RECOMMENDATION",
  GENERAL_RECOMMENDATION: "GENERAL_RECOMMENDATION",
  GENERAL_INFORMATION_QUESTION: "GENERAL_INFORMATION_QUESTION",
  ACCOUNT_LIBRARY_RECOMMENDATION: "ACCOUNT_LIBRARY_RECOMMENDATION",
  UNKNOWN: "UNKNOWN",
});

const normalize = (value = "") => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
const recommendationPattern = /\b(?:something|anything)\s+(?:like|lighter|darker|shorter|funnier|gentler|less|more)|\b(?:another|alternative|recommend|recommendation|pick|find me|give me|watch after|what should i watch after|similar but|instead)\b|\b(?:less scary|less intense|more modern)\s+(?:than|instead)?\b/i;
const comparisonPattern = /\b(?:better than|compare|which should i watch|this or|it or|versus|vs\.?|should i watch (?:this|it) or)\b/i;
const questionPattern = /^(?:is|are|does|do|will|would|can|could|should|how|what|who|when|where|why)\b|\b(?:scary|violent|violence|gore|jump scare|sad|funny|confusing|slow|appropriate|good for|happy ending|runtime|how long|toddler|kid|child|group|date movie)\b/i;

export const classifyAskIntent = ({ prompt, context = {} } = {}) => {
  const value = normalize(prompt);
  const page = normalize(context.page);
  if (!value) return ASK_INTENTS.UNKNOWN;
  if (comparisonPattern.test(value)) return ASK_INTENTS.MOVIE_COMPARISON;
  if (recommendationPattern.test(value)) {
    if (page === "my_movies") return ASK_INTENTS.ACCOUNT_LIBRARY_RECOMMENDATION;
    if (page === "browse" || page === "now_playing") return ASK_INTENTS.CURRENT_SET_RECOMMENDATION;
    if (page === "movie_detail" || context.movie?.id || context.movieId) return ASK_INTENTS.MOVIE_RECOMMENDATION;
    return ASK_INTENTS.GENERAL_RECOMMENDATION;
  }
  if (page === "movie_detail" || context.movie?.id || context.movieId) return ASK_INTENTS.CURRENT_MOVIE_QUESTION;
  if (page === "browse" || page === "now_playing") return ASK_INTENTS.CURRENT_SET_RECOMMENDATION;
  if (page === "my_movies") return ASK_INTENTS.ACCOUNT_LIBRARY_RECOMMENDATION;
  if (questionPattern.test(value)) return ASK_INTENTS.GENERAL_INFORMATION_QUESTION;
  return ASK_INTENTS.GENERAL_RECOMMENDATION;
};

export const getAskLoadingCopy = (intent) => {
  if (intent === ASK_INTENTS.MOVIE_COMPARISON) return "Comparing…";
  if (intent === ASK_INTENTS.CURRENT_MOVIE_QUESTION || intent === ASK_INTENTS.GENERAL_INFORMATION_QUESTION) return "Checking…";
  return "Finding a pick…";
};
