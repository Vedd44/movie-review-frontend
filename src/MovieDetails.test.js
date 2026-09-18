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
    movie: {
      title: "Aliens",
      runtime: 137,
      genre_names: ["Action", "Thriller", "Science Fiction"],
      content_signals: { peril: 0.82, scariness: 0.6, stimulation_level: 0.53 },
    },
    recommendationContext: { source: "reelbot_pick", prompt: "tense sci-fi", intent: { tone: ["tense"] } },
  });
  expect(take.heading).toBe("Why ReelBot Picked This");
  expect(take.assessment).toContain("sustained tension matches");
});

test("prioritizes Paddington 2's family signals over its Adventure genre", () => {
  const take = buildReelbotTake({
    movie: {
      title: "Paddington 2",
      runtime: 104,
      genre_names: ["Adventure", "Comedy", "Family"],
      audience_signals: { kid_friendliness: 1, consensus_friendliness: 0.86 },
      content_signals: { peril: 0.04, scariness: 0, stimulation_level: 0.31, emotional_intensity: 0.28 },
      watch_signals: { warmth_score: 0.42 },
    },
    recommendationContext: null,
  });
  expect(take.assessment).toBe("A gentle, low-stress family watch with broad group appeal, running 104 minutes.");
  expect(take.goodFit).not.toMatch(/set pieces|sustained tension|momentum/i);
});

test.each([
  [
    "Aliens",
    {
      title: "Aliens", runtime: 137, genre_names: ["Action", "Thriller", "Science Fiction"],
      content_signals: { peril: 0.82, scariness: 0.6, stimulation_level: 0.53, emotional_intensity: 0.48 },
    },
    {
      assessment: "A high-intensity science-fiction action watch built around sustained peril, running 137 minutes.",
      goodFit: "You want sustained suspense and large-scale action, and you are comfortable with horror-level threat.",
      maybeNot: "You need something calm, family-friendly, or easy to dip in and out of tonight.",
    },
  ],
  [
    "When Harry Met Sally...",
    {
      title: "When Harry Met Sally...", runtime: 96, genre_names: ["Comedy", "Romance", "Drama"],
      content_signals: { peril: 0, scariness: 0, stimulation_level: 0.26, emotional_intensity: 0.39 },
    },
    {
      assessment: "A relaxed, low-stress romantic comedy with some emotional pull, running 96 minutes.",
      goodFit: "You want romance and humor in a low-intensity watch that fits comfortably into an evening.",
      maybeNot: "You want suspense, spectacle, or a more plot-driven movie tonight.",
    },
  ],
  [
    "The Social Network",
    {
      title: "The Social Network", runtime: 121, genre_names: ["Drama"],
      description: "A programmer's success leads to personal and legal complications.",
      keyword_names: ["hacker", "social media", "legal drama", "based on true story"],
      content_signals: { peril: 0.12, scariness: 0.08, stimulation_level: 0.35, emotional_intensity: 0.44 },
      watch_signals: { warmth_score: 0.22 },
    },
    {
      assessment: "A focused, idea-driven drama with low physical intensity, running 121 minutes.",
      goodFit: "You want sharp interpersonal conflict built around ambition, ideas, and real-world consequences.",
      maybeNot: "You want warmth, escapism, or something comfortable for distracted viewing.",
    },
  ],
  [
    "Paddington 2",
    {
      title: "Paddington 2", runtime: 104, genre_names: ["Adventure", "Comedy", "Family"],
      audience_signals: { kid_friendliness: 1, consensus_friendliness: 0.86 },
      content_signals: { peril: 0.04, scariness: 0, stimulation_level: 0.31, emotional_intensity: 0.28 },
    },
    {
      assessment: "A gentle, low-stress family watch with broad group appeal, running 104 minutes.",
      goodFit: "You want an easy shared watch with comedy and room for younger viewers.",
      maybeNot: "You want adult-scale stakes, sharper tension, or something more demanding tonight.",
    },
  ],
])("renders the approved deterministic Take for %s", (_title, movie, expected) => {
  expect(buildReelbotTake({ movie, recommendationContext: null })).toMatchObject(expected);
});
