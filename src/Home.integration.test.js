import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import Home from "./Home";
import useTasteProfile from "./hooks/useTasteProfile";

jest.mock("axios");
jest.mock("./hooks/useTasteProfile");
jest.mock("./context/AuthContext", () => ({
  useAuth: () => ({ user: null, openAuthPrompt: jest.fn() }),
}));

const pickPayload = {
  primary: { id: 679, title: "Aliens", genre_ids: [28, 878], release_date: "1986-07-18" },
  alternates: [],
  resolved_intent: { prompt: "Under 100 minutes" },
  candidate_pool_ids: [679],
};

beforeEach(() => {
  window.localStorage.clear();
  useTasteProfile.mockReturnValue({
    profile: { skipped: [], seen: [] },
    behavioralMemory: {},
    actions: {
      clearActiveHomePick: jest.fn().mockResolvedValue(),
      recordPickResult: jest.fn().mockResolvedValue(),
      recordSwapFeedback: jest.fn().mockResolvedValue(),
      savePickPreferences: jest.fn().mockResolvedValue(),
    },
    getPickExcludedIds: jest.fn(() => []),
    getMovieState: jest.fn(() => ({ inWatchlist: false, seen: false, skipped: false, likedVibe: false })),
  });
  axios.get.mockResolvedValue({
    data: { results: [{ id: 1, title: "Arrival", release_date: "2016-11-10" }], total_pages: 1 },
  });
  axios.post.mockResolvedValue({ data: pickPayload });
});

test("clears the homepage picker after accepting a prompt while preserving the request prompt", async () => {
  render(<MemoryRouter><Home /></MemoryRouter>);

  const input = await screen.findByPlaceholderText(/smart thriller under two hours/i);
  fireEvent.change(input, { target: { value: "Under 100 minutes" } });
  fireEvent.click(screen.getByRole("button", { name: "Get a pick" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/reelbot/pick"),
    expect.objectContaining({ prompt: "Under 100 minutes" }),
    expect.anything()
  ));
  expect(input).toHaveValue("");
});

test("does not clear an invalid homepage prompt", async () => {
  render(<MemoryRouter><Home /></MemoryRouter>);

  const input = await screen.findByPlaceholderText(/smart thriller under two hours/i);
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Get a pick" }));

  expect(input).toHaveValue("   ");
  expect(screen.getByRole("alert")).toHaveTextContent(/Enter a vibe/i);
  expect(axios.post).not.toHaveBeenCalledWith(expect.stringContaining("/reelbot/pick"), expect.anything(), expect.anything());
});
