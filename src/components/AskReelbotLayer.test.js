import { getPanelConfig } from "./AskReelbotLayer";

test("adapts Ask ReelBot actions to movie details", () => {
  const config = getPanelConfig({ page: "movie_detail", movieTitle: "Alien" });

  expect(config.heading).toBe("Ask about Alien");
  expect(config.actions).toContainEqual(["Something less intense", "something like this, but less intense"]);
  expect(config.actions).toContainEqual(["Good for a group", "is this good for a group?"]);
});

test("adapts Ask ReelBot to constrained page collections", () => {
  const browse = getPanelConfig({ page: "browse", visibleMovieIds: [1, 2] });
  const nowPlaying = getPanelConfig({ page: "now_playing" });
  const myMovies = getPanelConfig({ page: "my_movies" });

  expect(browse.prompt).toBe("Pick from these results");
  expect(browse.heading).toBe("Ask ReelBot about these movies");
  expect(nowPlaying.heading).toBe("Pick from what’s in theaters");
  expect(myMovies.heading).toBe("Pick from My Movies");
});

test("labels an active recommendation as a refinement context", () => {
  expect(getPanelConfig({ page: "recommendation", currentPick: { title: "Alien" } }).heading).toBe("Refine this pick");
});
