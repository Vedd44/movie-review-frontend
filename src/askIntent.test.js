import { ASK_INTENTS, classifyAskIntent, getAskLoadingCopy } from "./askIntent";

const movieContext = { page: "movie_detail", movie: { id: 348, title: "Alien" } };
test('a complete new description on a movie page requests a recommendation', () => {
 expect(classifyAskIntent({prompt:'A movie about a woman receiving messages from the future',context:movieContext})).toBe(ASK_INTENTS.GENERAL_RECOMMENDATION);
});

test.each([
  ["who's in this?", ASK_INTENTS.CURRENT_MOVIE_QUESTION, "Checking…"],
  ["is this scary?", ASK_INTENTS.CURRENT_MOVIE_QUESTION, "Checking…"],
  ["something like this", ASK_INTENTS.MOVIE_RECOMMENDATION, "Finding your pick…"],
  ["something like this but less scary", ASK_INTENTS.MOVIE_RECOMMENDATION, "Finding your pick…"],
  ["should I watch this or Aliens?", ASK_INTENTS.MOVIE_COMPARISON, "Comparing…"],
])("classifies %s", (prompt, expectedIntent, expectedLoading) => {
  const intent = classifyAskIntent({ prompt, context: movieContext });
  expect(intent).toBe(expectedIntent);
  expect(getAskLoadingCopy(intent)).toBe(expectedLoading);
});

test("routes refinements and next picks from conversation state", () => {
  const conversation = { activeIntent: ASK_INTENTS.GENERAL_RECOMMENDATION, activeRequest: "Something smart but easy" };
  expect(classifyAskIntent({ prompt: "More mainstream", context: { page: "general" }, conversation })).toBe(ASK_INTENTS.REFINE_RECOMMENDATION);
  expect(classifyAskIntent({ prompt: "Another", context: { page: "general" }, conversation })).toBe(ASK_INTENTS.NEXT_RECOMMENDATION);
});

test("keeps pronoun follow-ups anchored to the current conversation movie", () => {
  const conversation = { activeIntent: ASK_INTENTS.CURRENT_MOVIE_QUESTION, anchorMovie: { id: 1, title: "Coyote vs. Acme" } };
  expect(classifyAskIntent({ prompt: "What about for a 7 year old?", context: { page: "general" }, conversation })).toBe(ASK_INTENTS.CURRENT_MOVIE_QUESTION);
});

test("keeps homepage discovery general while allowing active-pick refinements", () => {
  const context = { page: "home", currentPick: { id: 393, title: "Knives Out" } };
  expect(classifyAskIntent({ prompt: "What movies are out now that I might like?", context })).toBe(ASK_INTENTS.GENERAL_RECOMMENDATION);
  expect(classifyAskIntent({ prompt: "Is this scary?", context })).toBe(ASK_INTENTS.GENERAL_INFORMATION_QUESTION);
  expect(classifyAskIntent({ prompt: "Something gentler", context })).toBe(ASK_INTENTS.REFINE_RECOMMENDATION);
  expect(classifyAskIntent({ prompt: "Find something like this", context })).toBe(ASK_INTENTS.REFINE_RECOMMENDATION);
  expect(classifyAskIntent({ prompt: "I've already seen this", context })).toBe(ASK_INTENTS.REFINE_RECOMMENDATION);
});

test('questions and explicit topic changes do not become refinements', () => {
 const conversation={activeRequest:'Adult science fiction under 95 minutes',activeIntent:ASK_INTENTS.GENERAL_RECOMMENDATION,anchorMovie:{id:1}};
 expect(classifyAskIntent({prompt:'Is it shorter than two hours?',conversation})).toBe(ASK_INTENTS.CURRENT_MOVIE_QUESTION);
 expect(classifyAskIntent({prompt:'Actually, start fresh: a romantic comedy',conversation})).toBe(ASK_INTENTS.GENERAL_RECOMMENDATION);
});

test.each(['home','browse','movie_detail','general'])('keeps modified continuations active on %s',page=>{
 const conversation={activeRequest:'A sci-fi thriller, no horror, under 100 minutes',activeIntent:ASK_INTENTS.GENERAL_RECOMMENDATION,anchorMovie:{id:1}};
 for(const prompt of ['Another pick please','Another under 90 minutes','One more, but no horror','Something else','Make it under 90 minutes']) {
  expect(classifyAskIntent({prompt,context:{page},conversation})).toMatch(/^(NEXT|REFINE)_RECOMMENDATION$/);
 }
 expect(classifyAskIntent({prompt:'Actually, start fresh: a romantic comedy',context:{page},conversation})).toBe(ASK_INTENTS.GENERAL_RECOMMENDATION);
});

test('identification survives intervening questions and explicit new topics override clues',()=>{
 const conversation={activeIntent:'CURRENT_MOVIE_QUESTION',activeTask:'MOVIE_IDENTIFICATION',activeRequest:'What was that movie where a man uses tattoos?',anchorMovie:{id:77}};
 expect(classifyAskIntent({prompt:'He used Polaroid photographs too.',conversation})).toBe('MOVIE_IDENTIFICATION');
 expect(classifyAskIntent({prompt:'Actually, start fresh: a romantic comedy',conversation})).toBe(ASK_INTENTS.GENERAL_RECOMMENDATION);
});
