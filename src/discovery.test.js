import { getMoviePath, getPersonPath, getRecommendationMovieState, isActiveRecommendationMovieVisit, hasUsefulAskContext } from "./discovery";

test("contextual help waits for loaded movie or a nonempty film selection", () => {
  expect(hasUsefulAskContext(null)).toBe(false);
  expect(hasUsefulAskContext({ page: "person", visibleMovieIds: [] })).toBe(false);
  expect(hasUsefulAskContext({ page: "person", visibleMovieIds: [1] })).toBe(true);
  expect(hasUsefulAskContext({ page: "movie_detail", movieId: 1 })).toBe(true);
});

test("builds human-readable movie routes with a collision-reducing year", () => {
  expect(getMoviePath({ id: 679, title: "Aliens", release_date: "1986-07-18" })).toBe("/movies/aliens-1986");
});

test("builds human-readable people routes", () => {
  expect(getPersonPath({ id: 2710, name: "James Cameron" })).toBe("/people/james-cameron");
});

test("ties recommendation navigation state to the intended movie", () => {
  const state = getRecommendationMovieState({ id: 679, title: "Aliens" });
  expect(isActiveRecommendationMovieVisit(state, 679)).toBe(true);
  expect(isActiveRecommendationMovieVisit(state, 238)).toBe(false);
  expect(isActiveRecommendationMovieVisit(null, 679)).toBe(false);
});
