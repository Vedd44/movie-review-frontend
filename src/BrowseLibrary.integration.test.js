import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import BrowseLibrary from "./BrowseLibrary";
import useTasteProfile from "./hooks/useTasteProfile";

jest.mock("axios");
jest.mock("./hooks/useTasteProfile");

beforeEach(() => {
  Element.prototype.scrollIntoView = jest.fn();
  useTasteProfile.mockReturnValue({
    profile: { skipped: [], seen: [] },
    behavioralMemory: {},
    actions: {
      savePickPreferences: jest.fn().mockResolvedValue(),
      recordPickResult: jest.fn().mockResolvedValue(),
      recordSwapFeedback: jest.fn().mockResolvedValue(),
    },
    getPickExcludedIds: jest.fn(() => []),
    getMovieState: jest.fn(() => ({ inWatchlist: false, seen: false, skipped: false, likedVibe: false })),
    isCloudSyncing: false,
  });
  axios.get.mockImplementation((url) => {
    if (url.includes("/genres")) return Promise.resolve({ data: { genres: [{ id: 28, name: "Action" }] } });
    return Promise.resolve({ data: { results: [{ id: 679, title: "Aliens", genre_ids: [28, 878], poster_path: "/aliens.jpg", release_date: "1986-07-18", popularity: 80, vote_count: 1000 }], total_pages: 3, total_results: 60 } });
  });
  axios.post.mockResolvedValue({
    data: {
      primary: { id: 679, title: "Aliens", genre_ids: [28, 878], release_date: "1986-07-18" },
      alternates: [],
      resolved_intent: { tone: ["dark"] },
      candidate_pool_ids: [679],
    },
  });
});

test("progressively discloses runtime and sends all selected filters to the existing picker", async () => {
  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);

  expect(await screen.findByRole("heading", { name: "Library Results" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Trending" })).toHaveClass("active");
  expect(screen.getByRole("button", { name: "Now Playing" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Coming Soon" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Dark" }));
  fireEvent.click(screen.getByRole("button", { name: "Action" }));
  fireEvent.click(screen.getByText("Filters"));
  fireEvent.click(screen.getByRole("button", { name: "Under 2 hours" }));
  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot to pick one/i }));

  const picker = document.getElementById("library-reelbot-picker");
  fireEvent.click(within(picker).getByRole("checkbox", { name: /Include movies still in theaters/i }));
  fireEvent.click(within(picker).getByRole("button", { name: "Ask ReelBot" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalled());
  const requestBody = axios.post.mock.calls[0][1];
  expect(requestBody).toMatchObject({
    view: "popular",
    mood: "dark",
    runtime: "under_two_hours",
    genre: "28",
    include_theatrical: true,
  });
});
