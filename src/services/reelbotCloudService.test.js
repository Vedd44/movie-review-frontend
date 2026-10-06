import { buildMovieChanges, buildMovieRows, reelbotCloudService } from "./reelbotCloudService";
import { tasteProfileService } from "./tasteProfileService";
let mockWrites = [];
jest.mock("../lib/supabaseClient", () => ({ isSupabaseConfigured: true, getSupabaseClient: async () => ({
  from: table => {
    const query = { select: () => query, eq: () => query, order: () => query, range: () => query, maybeSingle: () => query,
      upsert: data => { mockWrites.push({ table, data }); return query; },
      then: resolve => resolve({ data: table === "user_movies" ? [{movie_id:9,status:"saved",movie_data:{id:9,title:"Remote"},created_at:"2020-01-01"}] : null, error: null }),
    }; return query;
  },
}) }));
beforeEach(() => { window.localStorage.clear(); mockWrites = []; });
test("delta writes cannot delete a movie unknown to the client snapshot", () => {
  const result = buildMovieChanges("a", { watchlist: [{id:1,title:"One"}] }, { watchlist: [{id:2,title:"Two"}] });
  expect(result.upserts.map(row => row.movie_id)).toEqual([1]);
  expect(result.removedIds).toEqual([2]);
});
test("saved plus seen status produces one row and preserves both meanings", () => {
  const movie = {id:1,title:"One"};
  expect(buildMovieRows("a", {watchlist:[movie],seen:[movie]})).toEqual([expect.objectContaining({movie_id:1,status:"seen",movie_data:expect.objectContaining({saved_to_watchlist:true})})]);
});
test("opening an account never merges a previous account's cache or writes remote state", async () => {
  window.localStorage.setItem("reelbotSupabaseMigration", JSON.stringify({user_id:"previous-account"}));
  tasteProfileService.save({...tasteProfileService.createEmptyProfile(),watchlist:[{id:1,title:"Private local"}]});
  const result = await reelbotCloudService.bootstrapUserState("new-account");
  expect(result.profile.watchlist.map(movie => movie.id)).toEqual([9]); expect(mockWrites).toEqual([]);
});
test("a library retains more than 36 saved movies", () => {
  let profile=tasteProfileService.createEmptyProfile();
  for(let id=1;id<=45;id++) profile=tasteProfileService.toggleWatchlist(profile,{id,title:`Movie ${id}`});
  expect(profile.watchlist).toHaveLength(45);
});

test("cloud movie rows preserve explicit recent viewing dates without inventing dates for older history", () => {
  const dated = {id:10,title:"Just watched",watched_at:"2026-10-06T12:00:00Z"};
  const undated = {id:11,title:"Seen before"};
  const rows = buildMovieRows("a", {seen:[dated,undated]});
  expect(rows.find(row => row.movie_id === 10).movie_data.watched_at).toBe(dated.watched_at);
  expect(rows.find(row => row.movie_id === 11).movie_data.watched_at).toBeUndefined();
});

test("cloud rows preserve neutral history and title-only feedback", () => {
  const rows = buildMovieRows("a", {seen:[{id:10,title:"Seen",taste_feedback:false}], skipped:[{id:11,title:"Not interested",taste_feedback:false}]});
  expect(rows).toEqual(expect.arrayContaining([
    expect.objectContaining({movie_id:10,status:"seen",movie_data:expect.objectContaining({taste_feedback:false})}),
    expect.objectContaining({movie_id:11,status:"hidden",movie_data:expect.objectContaining({taste_feedback:false})}),
  ]));
});
