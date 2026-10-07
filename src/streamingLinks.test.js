import { buildProviderLink, buildAvailabilityLink, safeProviderUrl } from "./streamingLinks";

test("uses the verified TMDB availability page when no direct provider link exists", () => {
  expect(buildProviderLink({
    movie: { title: "Alien", release_date: "1979-05-25" },
    provider: { id: 2, name: "Apple TV", access_type: "rent" },
    region: "US",
    availabilityLink: "https://www.themoviedb.org/movie/348/watch",
  })).toMatchObject({
    kind: "tmdb_availability",
    href: "https://www.themoviedb.org/movie/348/watch",
    label: "View Apple TV availability",
  });
});

test("keeps a verified movie-specific provider link", () => {
  expect(buildProviderLink({
    movie: { title: "Alien" },
    provider: { id: 2, name: "Apple TV", access_type: "rent", direct_link: "https://tv.apple.com/movie/verified" },
  })).toMatchObject({ kind: "direct_provider", href: "https://tv.apple.com/movie/verified" });
});

 test("rejects non-HTTPS and unexpected availability destinations", () => {
  expect(buildAvailabilityLink("javascript:alert(1)")).toBeNull();
  expect(buildAvailabilityLink("https://example.com/movie/1/watch")).toBeNull();
  expect(buildProviderLink({provider:{direct_link:"javascript:alert(1)"}})).toBeNull();
});

test("ordinary provider links remove affiliate tags while preserving movie routing", () => {
  expect(safeProviderUrl("https://tv.apple.com/us/movie/interstellar/id?at=partner&ct=campaign&itscg=30200&playableId=movie123")).toBe("https://tv.apple.com/us/movie/interstellar/id?playableId=movie123");
  expect(safeProviderUrl("https://watch.amazon.com/detail?gti=movie123&tag=partner&linkCode=abc")).toBe("https://watch.amazon.com/detail?gti=movie123");
  expect(safeProviderUrl("https://example.com/watch?at=00%3A10")).toBe("https://example.com/watch?at=00%3A10");
  expect(safeProviderUrl("javascript:alert(1)")).toBe("");
});
