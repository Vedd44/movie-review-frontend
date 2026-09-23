import { ASK_INTENTS, classifyAskIntent, getAskLoadingCopy } from "./askIntent";

const movieContext = { page: "movie_detail", movie: { id: 348, title: "Alien" } };

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
