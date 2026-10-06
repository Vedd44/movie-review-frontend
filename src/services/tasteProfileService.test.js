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

const movie = { id: 2049, title: "Blade Runner 2049" };
test("older Watched history does not invent a viewing date or permanently exclude", () => {
  let profile = tasteProfileService.recordPickResult(tasteProfileService.createEmptyProfile(), {prompt:"sci-fi"}, {primary:movie, alternates:[]});
  profile = tasteProfileService.toggleSeen(profile, movie);
  expect(profile.seen[0].watched_at).toBeUndefined();
  expect(tasteProfileService.getPickExcludedIds(profile, {prompt:"sci-fi"})).not.toContain(movie.id);
});
test("recent watch survives persistence and saved toggles; rewatch overrides only cooldown", () => {
  let profile = tasteProfileService.toggleSeen(tasteProfileService.createEmptyProfile(), movie, {watchedAt:new Date().toISOString()});
  profile = tasteProfileService.toggleWatchlist(profile, movie);
  tasteProfileService.save(profile);
  profile = tasteProfileService.load();
  expect(profile.seen[0].watched_at).toBeTruthy();
  expect(tasteProfileService.getPickExcludedIds(profile, {prompt:"sci-fi"})).toContain(movie.id);
  expect(tasteProfileService.getPickExcludedIds(profile, {prompt:"rewatch a favorite"})).not.toContain(movie.id);
  expect(tasteProfileService.getPickExcludedIds(profile, {prompt:"rewatch"}, [movie.id])).toContain(movie.id);
  profile = tasteProfileService.toggleSkipped(profile, movie);
  expect(tasteProfileService.getPickExcludedIds(profile, {prompt:"rewatch"})).toContain(movie.id);
});
test("expired viewing date restores eligibility without clearing Watched", () => {
  const profile = tasteProfileService.toggleSeen(tasteProfileService.createEmptyProfile(), movie, {watchedAt:"2020-01-01T12:00:00Z"});
  expect(tasteProfileService.getPickExcludedIds(profile, {prompt:"sci-fi"})).not.toContain(movie.id);
  expect(profile.seen).toHaveLength(1);
});
