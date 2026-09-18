import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import axios from "axios";
import MovieDetails from "./MovieDetails";
import useTasteProfile from "./hooks/useTasteProfile";

jest.mock("axios");
jest.mock("./hooks/useTasteProfile");

const movie = {
  id: 679,
  title: "Aliens",
  description: "Ripley returns to face the alien threat.",
  release_date: "1986-07-18",
  release_year: 1986,
  runtime: 137,
  status: "Released",
  director: "James Cameron",
  director_credit: { id: 2710, name: "James Cameron", profile_path: "/james.jpg" },
  top_cast: ["Sigourney Weaver"],
  top_cast_credits: [{ id: 10205, name: "Sigourney Weaver", character: "Ripley", profile_path: null }],
  genre_names: ["Action", "Science Fiction"],
  content_signals: { peril: 0.82, scariness: 0.6, stimulation_level: 0.53, emotional_intensity: 0.48 },
  audience_signals: { kid_friendliness: 0, consensus_friendliness: 0.28 },
  rating: 8.0,
  poster_path: "/aliens.jpg",
  trailer: { key: "aliens-trailer", name: "Aliens trailer" },
  watch_providers: {
    region: "US",
    link: "https://www.themoviedb.org/movie/679-aliens/watch?locale=US",
    subscription: [{ id: 8, name: "Netflix", logo_path: "/netflix.jpg" }],
    rent: [],
    buy: [],
  },
  review_highlights: {},
  similar: [{ id: 2787, title: "Pitch Black", release_date: "2000-02-18", poster_path: "/pitch-black.jpg" }],
};

const LocationProbe = () => <div data-testid="location">{useLocation().pathname}</div>;

beforeEach(() => {
  axios.get.mockResolvedValue({ data: movie });
  useTasteProfile.mockReturnValue({
    profile: { skipped: [] },
    actions: { addRecentMovie: jest.fn().mockResolvedValue(), recordDetailView: jest.fn().mockResolvedValue() },
    getRecommendationContextForMovie: jest.fn(() => null),
    getMovieState: jest.fn(() => ({ inWatchlist: false, seen: false, skipped: false, likedVibe: false })),
    isCloudSyncing: false,
  });
});

test("presents one contextual ReelBot entry point and factual watch providers", async () => {
  const askListener = jest.fn();
  window.addEventListener("reelbot:open-ask", askListener);

  render(
    <MemoryRouter initialEntries={["/movies/aliens-1986"]}>
      <Routes><Route path="/movies/:movieSlug" element={<MovieDetails />} /></Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "ReelBot’s Take" })).toBeInTheDocument();
  expect(screen.queryByText("Decision help")).not.toBeInTheDocument();
  expect(screen.queryByText("Why ReelBot recommends this")).not.toBeInTheDocument();
  expect(screen.queryByText("Quick Take or deeper check?")).not.toBeInTheDocument();
  expect(screen.getByText("Netflix")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Netflix/i })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /See current viewing options/i })).toHaveAttribute("href", movie.watch_providers.link);

  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot about Aliens/i }));
  expect(askListener).toHaveBeenCalled();
  window.removeEventListener("reelbot:open-ask", askListener);
});

test("groups movie hero actions in the intended order", async () => {
  render(
    <MemoryRouter initialEntries={["/movies/aliens-1986"]}>
      <Routes><Route path="/movies/:movieSlug" element={<MovieDetails />} /></Routes>
    </MemoryRouter>
  );

  const actionGroup = await screen.findByRole("group", { name: "Movie actions" });
  expect(actionGroup).toHaveClass("detail-hero-actions--simplified");
  expect(within(actionGroup).getAllByRole("button").map((button) => button.textContent.trim())).toEqual([
    "Where to Watch",
    "Save",
    "Cast & details ↓",
    "Watch trailer ↗",
  ]);
});

test("does not reuse historical recommendation context for a direct, search, or browse visit", async () => {
  useTasteProfile.mockReturnValue({
    profile: { skipped: [] },
    actions: { addRecentMovie: jest.fn().mockResolvedValue(), recordDetailView: jest.fn().mockResolvedValue() },
    getRecommendationContextForMovie: jest.fn(() => ({
      source: "reelbot_pick",
      prompt: "tense sci-fi",
      intent: { tone: ["tense"] },
    })),
    getMovieState: jest.fn(() => ({ inWatchlist: false, seen: false, skipped: false, likedVibe: false })),
    isCloudSyncing: false,
  });

  render(
    <MemoryRouter initialEntries={["/movies/aliens-1986"]}>
      <Routes><Route path="/movies/:movieSlug" element={<MovieDetails />} /></Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "ReelBot’s Take" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Why ReelBot Picked This" })).not.toBeInTheDocument();
});

test("uses historical context when the current history entry is an active recommendation visit", async () => {
  useTasteProfile.mockReturnValue({
    profile: { skipped: [] },
    actions: { addRecentMovie: jest.fn().mockResolvedValue(), recordDetailView: jest.fn().mockResolvedValue() },
    getRecommendationContextForMovie: jest.fn(() => ({
      source: "reelbot_pick",
      prompt: "tense sci-fi",
      intent: { tone: ["tense"] },
    })),
    getMovieState: jest.fn(() => ({ inWatchlist: false, seen: false, skipped: false, likedVibe: false })),
    isCloudSyncing: false,
  });

  render(
    <MemoryRouter initialEntries={[{
      pathname: "/movies/aliens-1986",
      state: { source: "reelbot_pick", recommendationVisit: { movieId: 679 } },
    }]}>
      <Routes><Route path="/movies/:movieSlug" element={<MovieDetails />} /></Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Why ReelBot Picked This" })).toBeInTheDocument();
  expect(screen.getByText(/sustained tension matches/i)).toBeInTheDocument();
});

test("links cast and director to canonical people routes and handles missing headshots", async () => {
  window.scrollTo = jest.fn();
  render(
    <MemoryRouter initialEntries={["/movies/aliens-1986"]}>
      <Routes><Route path="/movies/:movieSlug" element={<MovieDetails />} /></Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Cast & Details" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /James Cameron/i })).toHaveAttribute("href", "/people/james-cameron");
  expect(screen.getByRole("link", { name: /Sigourney Weaver/i })).toHaveAttribute("href", "/people/sigourney-weaver");
  fireEvent.click(screen.getByRole("button", { name: /Cast & details/i }));
  expect(window.scrollTo).toHaveBeenCalled();
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/movies/resolve/aliens-1986")));
});

test("legacy movie URLs canonicalize to title and year", async () => {
  render(
    <MemoryRouter initialEntries={["/movies/679/aliens"]}>
      <Routes>
        <Route path="/movies/:legacyMovieId/:legacySlug" element={<><MovieDetails /><LocationProbe /></>} />
        <Route path="/movies/:movieSlug" element={<><MovieDetails /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Aliens" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/movies/aliens-1986"));
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/movies/679"));
});
