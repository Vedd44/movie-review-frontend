import { getTimeCommitment, selectDiverseSimilarMovies } from "./MovieDetails";
import { buildReelbotTake } from "./detailDecision";

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

test("does not claim a direct visit was recommended", () => {
  const take = buildReelbotTake({
    movie: { title: "Aliens", runtime: 137, genre_names: ["Action", "Science Fiction"], director: "James Cameron" },
    recommendationContext: null,
  });
  expect(take.heading).toBe("ReelBot’s Take");
  expect(take.hasReliableProvenance).toBe(false);
});

test("uses recommendation-specific language only with stored prompt and intent", () => {
  const take = buildReelbotTake({
    movie: { title: "Aliens", runtime: 137, genre_names: ["Action", "Science Fiction"], director: "James Cameron" },
    recommendationContext: { source: "reelbot_pick", prompt: "tense sci-fi", intent: { tone: ["tense"] } },
  });
  expect(take.heading).toBe("Why ReelBot Picked This");
  expect(take.assessment).toContain("tense sci-fi");
});
