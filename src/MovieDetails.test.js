import { getTimeCommitment, selectDiverseSimilarMovies } from "./MovieDetails";

test.each([
  [89, "Short and easy to fit in."],
  [100, "Comfortably under two hours."],
  [115, "Right around two hours."],
  [131, "A longer watch — plan on a little over two hours."],
  [150, "A substantial time commitment."],
  [170, "An epic-length watch."],
])("describes %i minutes deterministically", (runtime, expected) => {
  expect(getTimeCommitment(runtime)).toBe(expected);
});

test("does not fill related titles with repeated franchise entries", () => {
  const result = selectDiverseSimilarMovies([
    { id: 1, title: "The Bourne Identity" },
    { id: 2, title: "The Bourne Supremacy" },
    { id: 3, title: "Ronin" },
    { id: 4, title: "Enemy of the State" },
  ]);
  expect(result.map((movie) => movie.title)).toEqual(["The Bourne Identity", "Ronin", "Enemy of the State"]);
});
