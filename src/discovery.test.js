import { getMoviePath, getPersonPath } from "./discovery";

test("builds human-readable movie routes with a collision-reducing year", () => {
  expect(getMoviePath({ id: 679, title: "Aliens", release_date: "1986-07-18" })).toBe("/movies/aliens-1986");
});

test("builds human-readable people routes", () => {
  expect(getPersonPath({ id: 2710, name: "James Cameron" })).toBe("/people/james-cameron");
});
