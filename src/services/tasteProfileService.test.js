import { tasteProfileService } from "./tasteProfileService";

beforeEach(() => {
  window.localStorage.clear();
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

test("clears active home pick state without deleting recommendation history", () => {
  const profile = tasteProfileService.createEmptyProfile();
  const recorded = tasteProfileService.recordPickResult(
    profile,
    { prompt: "tense sci-fi", source: "library" },
    { primary: { id: 679, title: "Aliens" }, alternates: [{ id: 348, title: "Alien" }], resolved_intent: { tone: ["tense"] } }
  );
  tasteProfileService.saveHomePickSession({ originalPrompt: "tense sci-fi", currentPick: { primary: { id: 679, title: "Aliens" } } });

  const cleared = tasteProfileService.clearActiveHomePick(recorded, [679, 348]);

  expect(tasteProfileService.loadHomePickSession()).toBeNull();
  expect(cleared.lastPickPreferences).toBeNull();
  expect(cleared.lastResolvedIntent).toBeNull();
  expect(cleared.pickHistory).toHaveLength(1);
  expect(tasteProfileService.getRecommendationContextForMovie(cleared, 679)).toBeNull();
});
