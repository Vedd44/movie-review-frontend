const questionKey = value => String(value || '').toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
// Group interchangeable facts, not distinct judgments or specific roles.
export const followUpKey = value => {
  const text = questionKey(value);
  if (/^(?:who (?:stars|starred|acts|acted|is starring)(?: in |$)|who(?:s| is) (?:in (?:it|this|the (?:cast|movie|film))|in the cast)|(?:who|which actors) (?:are|is) in|(?:show|list|tell me) (?:me )?(?:the )?(?:main |top )?cast|what(?:s| is) (?:the )?(?:main |top )?cast)/.test(text)) return 'fact:cast';
  if (/^(?:who (?:directed|directs)|who(?:s| is) (?:the )?director)/.test(text)) return 'fact:director';
  if (/^(?:how long (?:is (?:it|this|the movie|the film)|does (?:it|this|the movie|the film) (?:last|run))|what(?:s| is) (?:the |its )?runtime|how (?:many minutes|much time should i set aside))/.test(text)) return 'fact:runtime';
  if (/^(?:what (?:is|s) (?:it|this|the movie|the film) about|what(?:s| is) (?:the )?(?:story|premise|plot)(?: about)?$)/.test(text)) return 'fact:premise';
  return text;
};
export const askSubjectKey = (context = {}, conversation = {}) => {
  const movieId = conversation.anchorMovie?.id || context.movie?.id || context.currentPick?.id || context.movieId;
  if (movieId) return `movie:${movieId}`;
  return `${context.page || 'general'}:${context.personId || context.person?.id || context.personName || context.collectionSlug || ''}`;
};
export const filterAskedFollowUps = (suggestions = [], answered = [], subject) => {
  const settled = new Set(answered.filter(entry => entry.subject === subject).map(entry => followUpKey(entry.question)));
  const offered = new Set();
  return suggestions.filter(question => {
    const key = followUpKey(question);
    if (!key || settled.has(key) || offered.has(key)) return false;
    offered.add(key);
    return true;
  });
};
