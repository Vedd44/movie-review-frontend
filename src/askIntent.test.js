import { ASK_INTENTS, classifyAskIntent, getAskLoadingCopy } from "./askIntent";

const movieContext = { page: "movie_detail", movie: { id: 348, title: "Alien" } };

test.each([
  ["who's in this?", ASK_INTENTS.CURRENT_MOVIE_QUESTION, "Checking…"],
  ["is this scary?", ASK_INTENTS.CURRENT_MOVIE_QUESTION, "Checking…"],
  ["something like this", ASK_INTENTS.MOVIE_RECOMMENDATION, "Finding a pick…"],
  ["something like this but less scary", ASK_INTENTS.MOVIE_RECOMMENDATION, "Finding a pick…"],
  ["should I watch this or Aliens?", ASK_INTENTS.MOVIE_COMPARISON, "Comparing…"],
])("classifies %s", (prompt, expectedIntent, expectedLoading) => {
  const intent = classifyAskIntent({ prompt, context: movieContext });
  expect(intent).toBe(expectedIntent);
  expect(getAskLoadingCopy(intent)).toBe(expectedLoading);
});
