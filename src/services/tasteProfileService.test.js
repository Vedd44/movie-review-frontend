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
  expect(tasteProfileService.getPickExcludedIds(profile, {prompt:"something I have not watched"})).toContain(movie.id);
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

test("Seen it persists history without inferring a viewing date or positive taste", () => {
  const film = {...movie, genre_ids:[878], runtime:164, overview:"A dark futuristic thriller"};
  let profile = tasteProfileService.toggleSeen(tasteProfileService.createEmptyProfile(), film, {historyOnly:true});
  tasteProfileService.save(profile);
  profile = tasteProfileService.load();
  expect(profile.seen[0]).toMatchObject({id:movie.id, taste_feedback:false});
  expect(profile.seen[0].watched_at).toBeUndefined();
  expect(profile.behavioralMemory.seenMovieIds).toContain(movie.id);
  expect(profile.behavioralMemory.preferredGenres).toEqual({});
  expect(profile.behavioralMemory.userProfile.likedGenres).toEqual([]);
  expect(profile.recentMovies).toEqual([]);
  expect(tasteProfileService.getPickExcludedIds(profile, {prompt:"sci-fi"})).not.toContain(movie.id);
});
test("Not interested excludes only the title, survives reload and can be undone", () => {
  const film = {...movie, genre_ids:[878], runtime:164, overview:"A dark futuristic thriller"};
  let profile = tasteProfileService.toggleSkipped(tasteProfileService.createEmptyProfile(), film, {titleOnly:true});
  tasteProfileService.save(profile);
  profile = tasteProfileService.load();
  expect(profile.skipped[0]).toMatchObject({id:movie.id, taste_feedback:false});
  expect(tasteProfileService.getPickExcludedIds(profile, {prompt:"sci-fi"})).toContain(movie.id);
  expect(profile.behavioralMemory.avoidedGenres).toEqual({});
  expect(profile.behavioralMemory.userProfile.avoidTraits).toEqual({pace:[],tone:[],runtime:[]});
  profile = tasteProfileService.toggleSkipped(profile, film);
  expect(profile.skipped).toEqual([]);
  expect(tasteProfileService.getPickExcludedIds(profile, {prompt:"sci-fi"})).not.toContain(movie.id);
  expect(profile.behavioralMemory.avoidedGenres).toEqual({});
});


test('another pick excludes previous winners but keeps unselected alternatives eligible',()=>{
 const prompt='People working overnight at a diner';
 const preferences={prompt,source:'library',view:'popular',mood:'all',runtime:'any',company:'any'};
 const profile=tasteProfileService.recordPickResult(tasteProfileService.createEmptyProfile(),preferences,{primary:{id:101,title:'First'},alternates:[{id:102,title:'Other option'}]});
 expect(tasteProfileService.getPickExcludedIds(profile,{...preferences,is_swap:true},[101])).toContain(101);
 expect(tasteProfileService.getPickExcludedIds(profile,{...preferences,is_swap:true},[101])).not.toContain(102);
 expect(tasteProfileService.getPickExcludedIds(profile,preferences)).toContain(102);
});
