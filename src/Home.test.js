import { trimMoviesToDisplayCount } from "./Home";

const makeMovies = (count) => Array.from({ length: count }, (_, index) => ({ id: index + 1 }));

test("keeps a small valid feed instead of collapsing it to an empty grid", () => {
  expect(trimMoviesToDisplayCount(makeMovies(3))).toHaveLength(3);
});

test("keeps complete rows when a larger feed is still below the normal display count", () => {
  expect(trimMoviesToDisplayCount(makeMovies(7))).toHaveLength(5);
});
