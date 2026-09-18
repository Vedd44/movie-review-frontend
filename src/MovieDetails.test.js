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
  expect(take.assessment).toMatch(/temporarily unavailable/i);
});

test("renders validated generic Take content without reinterpreting it", () => {
  const genericTake = {
    assessment: "A warm, brisk family adventure whose comic complications keep returning to kindness and good company.",
    good_fit_if: "You want an upbeat shared watch with wit for adults and clarity for younger viewers.",
    maybe_not_if: "You want sharp-edged conflict, cynicism, or a demanding dramatic experience tonight.",
  };
  const take = buildReelbotTake({
    movie: { title: "Paddington 2", runtime: 104, genre_names: ["Adventure", "Comedy", "Family"] },
    genericTake,
  });
  expect(take).toMatchObject({
    heading: "ReelBot’s Take",
    assessment: genericTake.assessment,
    goodFit: genericTake.good_fit_if,
    maybeNot: genericTake.maybe_not_if,
  });
  expect(take.assessment).not.toMatch(/momentum|set pieces|sustained tension/i);
});

test("uses stored recommendation rationale only with active recommendation provenance", () => {
  const take = buildReelbotTake({
    movie: {
      title: "Aliens",
      runtime: 137,
      genre_names: ["Action", "Thriller", "Science Fiction"],
      content_signals: { peril: 0.82, scariness: 0.6, stimulation_level: 0.53 },
    },
    recommendationContext: {
      source: "reelbot_pick",
      prompt: "tense sci-fi",
      intent: { tone: ["tense"] },
      rationale: {
        decisionSentence: "Aliens turns the requested tension into sustained siege pressure and propulsive action.",
        whyRecommended: [
          "Its escalating threat directly matches the tense science-fiction brief.",
          "It is a poor fit if tonight calls for something calm or low-stress.",
        ],
      },
    },
  });
  expect(take.heading).toBe("Why ReelBot Picked This");
  expect(take.assessment).toContain("sustained siege pressure");
  expect(take.goodFit).toContain("directly matches");
  expect(take.maybeNot).toContain("poor fit");
});

test("does not use historical recommendation data without active provenance", () => {
  const take = buildReelbotTake({
    movie: { title: "Aliens", runtime: 137 },
    recommendationContext: null,
    genericTake: {
      assessment: "A pressure-cooker action film that keeps tactical competence and mounting dread in the same frame.",
      good_fit_if: "You want tense, muscular science fiction that rewards full attention.",
      maybe_not_if: "You need a calm, low-threat watch or something suitable for young children.",
    },
  });
  expect(take.heading).toBe("ReelBot’s Take");
  expect(take.assessment).not.toMatch(/picked|matched/i);
});
