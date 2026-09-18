import { tasteProfileService } from "./tasteProfileService";

beforeEach(() => {
  window.sessionStorage.clear();
});

test("preserves the existing recommendation rationale with historical provenance", () => {
  const profile = tasteProfileService.createEmptyProfile();
  const rationale = {
    decisionSentence: "Its escalating pressure matches the tense science-fiction request.",
    whyRecommended: ["It delivers the sustained tension the request prioritized."],
  };

  const nextProfile = tasteProfileService.recordPickResult(
    profile,
    { prompt: "tense sci-fi", source: "library" },
    {
      primary: { id: 679, title: "Aliens" },
      alternates: [],
      resolved_intent: { tone: ["tense"] },
      rationale,
    }
  );

  expect(tasteProfileService.getRecommendationContextForMovie(nextProfile, 679)).toMatchObject({
    source: "reelbot_pick",
    prompt: "tense sci-fi",
    intent: { tone: ["tense"] },
    rationale,
  });
});
