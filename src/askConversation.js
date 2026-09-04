const createConversationId = () => `ask-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const createAskConversation = (context = {}) => ({
  conversationId: createConversationId(),
  pageContext: context.page || "general",
  anchorMovie: context.movie || context.currentPick || (context.movieId ? { id: context.movieId, title: context.movieTitle || "" } : null),
  activeIntent: context.originalPrompt ? "GENERAL_RECOMMENDATION" : "",
  activeConstraints: context.activeConstraints || {},
  activeRequest: context.originalPrompt || "",
  lastUserMessage: "",
  lastAssistantResponse: "",
  recommendationHistory: [],
  userCorrections: [],
});

export const addHistoryStatus = (conversation = {}, movie = {}, status = "recommended") => ({
  ...conversation,
  recommendationHistory: [
    ...(conversation.recommendationHistory || []).filter((entry) => Number(entry.id) !== Number(movie.id)),
    { id: Number(movie.id) || null, title: movie.title || "", status },
  ].slice(-30),
});
