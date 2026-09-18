import { mergeBrowseMoviePages } from "./BrowseLibrary";

test("load more appends results without duplicate movies", () => {
  const merged = mergeBrowseMoviePages(
    [{ id: 1, title: "First" }, { id: 2, title: "Second" }],
    [{ id: 2, title: "Second" }, { id: 3, title: "Third" }]
  );
  expect(merged.map((movie) => movie.id)).toEqual([1, 2, 3]);
});

test("a new filter result replaces previously loaded pages", () => {
  expect(mergeBrowseMoviePages([{ id: 1 }], [{ id: 4 }], true)).toEqual([{ id: 4 }]);
});
