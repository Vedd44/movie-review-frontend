import { REELBOT_LOADING_QUOTES, pickLoadingQuote } from "./reelbotLoadingQuotes";

test("uses a static, short, attributed loading quote list", () => {
  expect(REELBOT_LOADING_QUOTES.length).toBeGreaterThan(4);
  REELBOT_LOADING_QUOTES.forEach(({ quote, movie }) => {
    expect(quote.trim().split(/\s+/).length).toBeLessThan(10);
    expect(movie).toBeTruthy();
  });
  expect(pickLoadingQuote(() => 0)).toEqual(REELBOT_LOADING_QUOTES[0]);
});
