import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  rating: 8.0,
  poster_path: "/aliens.jpg",
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
  expect(screen.queryByText("Why ReelBot recommends this")).not.toBeInTheDocument();
  expect(screen.queryByText("Quick Take or deeper check?")).not.toBeInTheDocument();
  expect(screen.getByText("Netflix")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Netflix/i })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /See current viewing options/i })).toHaveAttribute("href", movie.watch_providers.link);

  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot about Aliens/i }));
  expect(askListener).toHaveBeenCalled();
  window.removeEventListener("reelbot:open-ask", askListener);
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
