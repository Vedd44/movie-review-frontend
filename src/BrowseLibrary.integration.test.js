import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import BrowseLibrary from "./BrowseLibrary";
import useTasteProfile from "./hooks/useTasteProfile";
import { useAuth } from "./context/AuthContext";

// Keep pagination fixtures above the automatic first-grid fill threshold.
const browsePadding = Array.from({ length: 11 }, (_, i) => ({ id: 8000 + i, title: `Catalog fixture ${i}`, genre_ids: [28], poster_path: "/fixture.jpg", release_date: "2000-01-01", popularity: 20, vote_count: 100 }));

jest.mock("axios");
jest.mock("./hooks/useTasteProfile");
jest.mock("./context/AuthContext", () => ({ useAuth: jest.fn() }));

beforeEach(() => {
  useAuth.mockReturnValue({ user: null, openAuthPrompt: jest.fn(), maybePromptToSavePicks: jest.fn() });
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

test("labelled selects and a typed prompt reach the existing constrained picker", async () => {
  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);

  expect(await screen.findByRole("heading", { name: "Movies" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Trending" })).toHaveClass("active");
  expect(screen.getByRole("button", { name: "Now Playing" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Coming Soon" })).toBeInTheDocument();

  fireEvent.change(screen.getByRole("combobox", { name: "Mood" }), {target:{value:"dark"}});
  fireEvent.change(screen.getByRole("combobox", { name: "Genre" }), {target:{value:"28"}});
  fireEvent.change(screen.getByRole("combobox", { name: "Runtime" }), {target:{value:"under_two_hours"}});
  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot to pick one/i }));

  const picker = document.getElementById("library-reelbot-picker");
  fireEvent.change(within(picker).getByRole("textbox", {name:"Add a vibe"}), {target:{value:"A gritty thriller"}});
  fireEvent.click(within(picker).getByRole("checkbox", { name: /Include movies still in theaters/i }));
  fireEvent.click(within(picker).getByRole("button", { name: "Ask ReelBot" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalled());
  const requestBody = axios.post.mock.calls[0][1];
  expect(requestBody).toMatchObject({
    prompt: "A gritty thriller",
    view: "popular",
    mood: "dark",
    runtime: "under_two_hours",
    genre: "28",
    include_theatrical: true,
  });
});

test("load more appends a unique page and keeps the existing results", async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/genres")) return Promise.resolve({ data: { genres: [{ id: 28, name: "Action" }] } });
    if (url.includes("page=2")) return Promise.resolve({ data: { results: [
      { id: 679, title: "Aliens", genre_ids: [28, 878], poster_path: "/aliens.jpg", release_date: "1986-07-18", popularity: 80, vote_count: 1000 },
      { id: 2787, title: "Pitch Black", genre_ids: [28, 878], poster_path: "/pitch-black.jpg", release_date: "2000-02-18", popularity: 60, vote_count: 800 },
    ], total_pages: 2 } });
    return Promise.resolve({ data: { results: [
      { id: 679, title: "Aliens", genre_ids: [28, 878], poster_path: "/aliens.jpg", release_date: "1986-07-18", popularity: 80, vote_count: 1000 },
    ].concat(browsePadding), total_pages: 2 } });
  });

  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Aliens" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("link", { name: "Load more" }));

  expect(await screen.findByRole("heading", { name: "Pitch Black" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "Aliens" })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("type=popular&page=2"));
});

test("changing source resets progressive results to the new first page", async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/genres")) return Promise.resolve({ data: { genres: [] } });
    if (url.includes("type=latest")) return Promise.resolve({ data: { results: [
      { id: 1091, title: "The Thing", genre_ids: [27, 878], poster_path: "/thing.jpg", release_date: "1982-06-25", popularity: 70, vote_count: 900 },
    ], total_pages: 1 } });
    if (url.includes("page=2")) return Promise.resolve({ data: { results: [
      { id: 2787, title: "Pitch Black", genre_ids: [28, 878], poster_path: "/pitch-black.jpg", release_date: "2000-02-18", popularity: 60, vote_count: 800 },
    ], total_pages: 2 } });
    return Promise.resolve({ data: { results: [
      { id: 679, title: "Aliens", genre_ids: [28, 878], poster_path: "/aliens.jpg", release_date: "1986-07-18", popularity: 80, vote_count: 1000 },
    ].concat(browsePadding), total_pages: 2 } });
  });

  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Aliens" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Load more" }));
  expect(await screen.findByRole("heading", { name: "Pitch Black" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Now Playing" }));

  expect(await screen.findByRole("heading", { name: "The Thing" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Aliens" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Pitch Black" })).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("type=latest&page=1"));
});

test("changing a filter resets progressive results to the filtered first page", async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/genres")) return Promise.resolve({ data: { genres: [{ id: 28, name: "Action" }] } });
    if (url.includes("genre=28")) return Promise.resolve({ data: { results: [
      { id: 218, title: "The Terminator", genre_ids: [28, 878], poster_path: "/terminator.jpg", release_date: "1984-10-26", popularity: 75, vote_count: 950 },
    ], total_pages: 1 } });
    if (url.includes("page=2")) return Promise.resolve({ data: { results: [
      { id: 2787, title: "Pitch Black", genre_ids: [28, 878], poster_path: "/pitch-black.jpg", release_date: "2000-02-18", popularity: 60, vote_count: 800 },
    ], total_pages: 2 } });
    return Promise.resolve({ data: { results: [
      { id: 679, title: "Aliens", genre_ids: [28, 878], poster_path: "/aliens.jpg", release_date: "1986-07-18", popularity: 80, vote_count: 1000 },
    ].concat(browsePadding), total_pages: 2 } });
  });

  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Aliens" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Load more" }));
  expect(await screen.findByRole("heading", { name: "Pitch Black" })).toBeInTheDocument();

  fireEvent.change(await screen.findByRole("combobox", { name: "Genre" }), {target:{value:"28"}});

  expect(await screen.findByRole("heading", { name: "The Terminator" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Aliens" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Pitch Black" })).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("page=1&genre=28"));
});


test("editing and cancelling a Browse request preserves the displayed pick without another request", async () => {
  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /Ask ReelBot to pick one/i }));
  const picker = document.getElementById("library-reelbot-picker");
  fireEvent.change(within(picker).getByRole("textbox", { name: "Add a vibe" }), {target:{value:"A smart sci-fi movie"}});
  fireEvent.click(within(picker).getByRole("button", { name: "Ask ReelBot" }));
  await waitFor(() => expect(within(picker).getByRole("heading", {name:"Aliens"})).toBeInTheDocument());
  expect(useAuth().maybePromptToSavePicks).not.toHaveBeenCalled();
  expect(useAuth().openAuthPrompt).not.toHaveBeenCalled();
  fireEvent.click(within(picker).getByRole("button", {name:"Create account"}));
  expect(useAuth().openAuthPrompt).toHaveBeenCalledWith("session_browse_inline");
  const count = axios.post.mock.calls.length;
  expect(within(picker).getByText("A smart sci-fi movie")).toBeVisible();
  expect(within(picker).queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(within(picker).getByRole("button", {name:"Edit"}));
  fireEvent.change(within(picker).getByRole("textbox", {name:"Add a vibe"}), {target:{value:"Different draft"}});
  expect(within(picker).getByRole("button", {name:"Get another pick"})).toBeDisabled();
  fireEvent.click(within(picker).getByRole("button", {name:"Cancel edit"}));
  expect(within(picker).getByRole("heading", {name:"Aliens"})).toBeInTheDocument();
  expect(within(picker).getByText("A smart sci-fi movie")).toBeVisible();
  expect(axios.post).toHaveBeenCalledTimes(count);
  fireEvent.click(within(picker).getByRole("button", {name:"Edit"}));
  expect(within(picker).getByRole("textbox", {name:"Add a vibe"})).toHaveValue("A smart sci-fi movie");
});


test('Browse another pick preserves the submitted prompt after a cancelled edit',async()=>{
  const prompt='Movie where people work late night at a food place';
  axios.post.mockResolvedValueOnce({data:{primary:{id:679,title:'The Last Shift',genre_ids:[18]},alternates:[],resolved_preferences:{prompt},candidate_pool_ids:[679]}})
    .mockResolvedValueOnce({data:{primary:{id:78,title:'Waiting…',genre_ids:[35]},alternates:[],resolved_preferences:{prompt},candidate_pool_ids:[78]}});
  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:/Ask ReelBot to pick one/i}));
  const picker=document.getElementById('library-reelbot-picker');
  fireEvent.change(within(picker).getByRole('textbox',{name:'Add a vibe'}),{target:{value:prompt}});
  fireEvent.click(within(picker).getByRole('button',{name:'Ask ReelBot'}));
  await within(picker).findByRole('heading',{name:'The Last Shift'});
  fireEvent.click(within(picker).getByRole('button',{name:'Edit'}));
  fireEvent.change(within(picker).getByRole('textbox',{name:'Add a vibe'}),{target:{value:'Different draft'}});
  fireEvent.click(within(picker).getByRole('button',{name:'Cancel edit'}));
  fireEvent.click(within(picker).getByRole('button',{name:'Get another pick'}));
  await within(picker).findByRole('heading',{name:'Waiting…'});
  expect(axios.post.mock.calls[1][1]).toEqual(expect.objectContaining({prompt,original_prompt:prompt,is_swap:true}));
});
