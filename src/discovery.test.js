import { getMoviePath, getPersonPath, getRecommendationMovieState, isActiveRecommendationMovieVisit } from "./discovery";

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
