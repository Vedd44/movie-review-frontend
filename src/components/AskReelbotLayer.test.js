import { getPanelConfig } from "./AskReelbotLayer";

test("adapts Ask ReelBot actions to movie details", () => {
  const config = getPanelConfig({ page: "movie_detail", movieTitle: "Alien" });

  expect(config.heading).toBe("Ask about Alien");
  expect(config.actions).toContainEqual(["How intense is it?", "How intense is it?"]);
  expect(config.actions).not.toContainEqual(["Explain the ending", "Explain the ending"]);
  expect(config.actions).not.toContainEqual(["Something like this", "something like this"]);
});

test("keeps refinement, general, and person suggestions in their own contexts", () => {
  const refinement = getPanelConfig({ page: "recommendation", currentPick: { title: "Alien" } });
  const general = getPanelConfig({ page: "home" });
  const person = getPanelConfig({ page: "person", personName: "Sigourney Weaver" });

  expect(refinement.actions).toContainEqual(["Something like this", "something like this"]);
  expect(general.actions).toContainEqual(["Find me something to watch", "something worth watching tonight"]);
  expect(person.heading).toBe("Choose a Sigourney Weaver movie");
  expect(person.actions).toContainEqual(["Where should I start?", "Pick a good starting point from this filmography"]);
  expect(person.actions).not.toContainEqual(["How intense is it?", "How intense is it?"]);
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
