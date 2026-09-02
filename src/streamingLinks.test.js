import { buildProviderLink } from "./streamingLinks";

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
