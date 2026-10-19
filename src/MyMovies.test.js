import { useLayoutEffect } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Link, Routes, Route, MemoryRouter } from "react-router-dom";
import TasteActionBar from "./components/TasteActionBar";
import MyMovies from "./MyMovies";
import { openAskReelbot, useAskReelbotPageContext } from "./context/AskReelbotContext";
import useTasteProfile, { TasteProfileProvider } from "./hooks/useTasteProfile";
import { reelbotCloudService } from "./services/reelbotCloudService";
import { tasteProfileService } from "./services/tasteProfileService";

let mockUser = { id: "library-owner" };
let mockAuthReady = true;
const mockOpenAuthPrompt = jest.fn();
jest.mock("./context/AuthContext", () => ({ useAuth: () => ({ user: mockUser, authReady: mockAuthReady, openAuthPrompt: mockOpenAuthPrompt }), PENDING_SAVE_KEY: "pending-save" }));
jest.mock("./context/AskReelbotContext", () => ({ useAskReelbotPageContext: jest.fn(), openAskReelbot: jest.fn() }));
jest.mock("./seo", () => ({ usePageMetadata: jest.fn(), buildBreadcrumbJsonLd: jest.fn() }));
jest.mock("./services/reelbotCloudService", () => ({ reelbotCloudService: {
  isConfigured: true, getLocalProfileOwner: jest.fn(() => ""), clearLocalAccountCache: jest.fn(),
  bootstrapUserState: jest.fn(), saveUserState: jest.fn(), activateLocalCache: jest.fn(),
} }));

const movie = { id: 23168, title: "The Town", release_date: "2010-09-15" };
const snapshot = (profile) => ({ profile, interactions: [], homePickSession: null });
const renderLibrary = (initialEntry = "/my-movies") => render(
  <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <TasteProfileProvider><MyMovies /></TasteProfileProvider>
  </MemoryRouter>
);
const lists = () => within(screen.getByRole("group", { name: "Saved movie lists" }));
const statuses = () => {
  const card = screen.getByRole("article");
  fireEvent.click(within(card).getByText("Manage"));
  return within(card);
};

beforeEach(() => {
  mockUser = { id: "library-owner" };
  mockAuthReady = true;
  localStorage.clear();
  jest.clearAllMocks();
  let profile = tasteProfileService.toggleWatchlist(tasteProfileService.createEmptyProfile(), movie);
  profile = tasteProfileService.toggleSeen(profile, movie);
  reelbotCloudService.bootstrapUserState.mockResolvedValue(snapshot(profile));
  reelbotCloudService.saveUserState.mockImplementation(async (id, next) => snapshot(next));
});

test("Manage shows both saved and watched states across lists and preserves Saved when unwatching", async () => {
  renderLibrary();
  await waitFor(() => expect(screen.queryByText("Saving your changes…")).not.toBeInTheDocument());
  await screen.findByRole("heading", {name:"The Town"});
  expect(screen.queryByText("Synced")).not.toBeInTheDocument();
  let menu = statuses();
  expect(menu.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
  expect(menu.getByRole("button", { name: "Watched" })).toHaveAttribute("aria-pressed", "true");
  expect(menu.getByRole("button", { name: "Not for me" })).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(lists().getByRole("button", { name: /^Watched/ }));
  menu = statuses();
  expect(menu.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(menu.getByRole("button", { name: "Watched" }));
  await screen.findByText("Nothing marked as watched yet.");
  await waitFor(() => expect(screen.queryByText("Saving your changes…")).not.toBeInTheDocument());
  fireEvent.click(lists().getByRole("button", { name: /^Saved/ }));
  menu = statuses();
  expect(menu.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
  expect(menu.getByRole("button", { name: "Watched" })).toHaveAttribute("aria-pressed", "false");
  expect(reelbotCloudService.saveUserState.mock.calls.at(-1)[1].watchlist).toHaveLength(1);
});

test("a pending mutation never claims Synced, and a failed mutation restores the movie with an error", async () => {
  let rejectSave;
  reelbotCloudService.saveUserState.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectSave = reject; }));
  renderLibrary();
  await waitFor(() => expect(screen.queryByText("Saving your changes…")).not.toBeInTheDocument());
  await screen.findByRole("heading", {name:"The Town"});
  fireEvent.click(statuses().getByRole("button", { name: "Saved" }));
  await screen.findByText("Saving your changes…");
  expect(screen.queryByText("Synced")).not.toBeInTheDocument();
  await waitFor(() => expect(rejectSave).toBeDefined());
  await act(async () => { rejectSave(new Error("Could not save. Try again.")); });
  expect(await screen.findByRole("heading", { name: "The Town" })).toBeInTheDocument();
  expect(screen.getByText("Could not save. Try again.")).toBeInTheDocument();
  expect(screen.queryByText("Synced")).not.toBeInTheDocument();
});


test("library search filters locally and clearing it preserves the saved list", async () => {
  renderLibrary();
  await screen.findByRole("heading", { name: "The Town" });
  const search = screen.getByRole("searchbox", { name: /Search/i });
  fireEvent.change(search, { target: { value: "no-such-movie" } });
  expect(screen.queryByRole("heading", { name: "The Town" })).not.toBeInTheDocument();
  fireEvent.change(search, { target: { value: "town" } });
  expect(screen.getByRole("heading", { name: "The Town" })).toBeInTheDocument();
  expect(reelbotCloudService.saveUserState).not.toHaveBeenCalled();
});

test("My Movies switches a rejected title to Watched and can restore recommendation eligibility", async () => {
  const profile = tasteProfileService.toggleSkipped(tasteProfileService.createEmptyProfile(), movie);
  reelbotCloudService.bootstrapUserState.mockResolvedValue(snapshot(profile));
  renderLibrary();
  await waitFor(() => expect(reelbotCloudService.bootstrapUserState).toHaveBeenCalled());
  fireEvent.click(lists().getByRole('button', { name: /^Not for me/ }));
  await screen.findByRole('heading', { name: movie.title });
  let menu = statuses();
  expect(menu.getByRole('button', { name: 'Not for me' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(menu.getByRole('button', { name: 'Watched' }));
  await screen.findByText('Nothing marked not for me.');
  await waitFor(() => expect(screen.queryByText('Saving your changes…')).not.toBeInTheDocument());
  fireEvent.click(lists().getByRole('button', { name: /^Watched/ }));
  menu = statuses();
  expect(menu.getByRole('button', { name: 'Watched' })).toHaveAttribute('aria-pressed', 'true');
  expect(menu.getByRole('button', { name: 'Not for me' })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(menu.getByRole('button', { name: 'Not for me' }));
  await screen.findByText('Nothing marked as watched yet.');
  await waitFor(() => expect(screen.queryByText('Saving your changes…')).not.toBeInTheDocument());
  fireEvent.click(lists().getByRole('button', { name: /^Not for me/ }));
  fireEvent.click(statuses().getByRole('button', { name: 'Not for me' }));
  await screen.findByText('Nothing marked not for me.');
  await waitFor(() => expect(screen.queryByText('Saving your changes…')).not.toBeInTheDocument());
  const restored = reelbotCloudService.saveUserState.mock.calls.at(-1)[1];
  expect(restored.skipped).toEqual([]);
  expect(tasteProfileService.getPickExcludedIds(restored, { prompt: 'a crime movie' })).not.toContain(movie.id);
});

test("Manage preserves a saved movie's full metadata when marking it Watched", async () => {
  const detailedMovie = {
    ...movie,
    runtime: 125,
    genre_ids: [80, 18],
    genre_names: ["Crime", "Drama"],
    popularity: 42,
    source_type: "reelbot_pick",
    taste_feedback: false,
  };
  const profile = tasteProfileService.toggleWatchlist(tasteProfileService.createEmptyProfile(), detailedMovie);
  reelbotCloudService.bootstrapUserState.mockResolvedValue(snapshot(profile));
  renderLibrary();
  await screen.findByRole("heading", { name: movie.title });
  fireEvent.click(statuses().getByRole("button", { name: "Watched" }));
  await waitFor(() => expect(reelbotCloudService.saveUserState).toHaveBeenCalledTimes(1));
  const savedProfile = reelbotCloudService.saveUserState.mock.calls[0][1];
  expect(savedProfile.watchlist[0]).toMatchObject(detailedMovie);
  expect(savedProfile.seen[0]).toMatchObject(detailedMovie);
  expect(savedProfile.recentMovies).toEqual([]);
  expect(screen.getByText("125 min")).toBeInTheDocument();
});


describe("library pick actions", () => {
  test.each([
    ["empty", false, false],
    ["saved only", true, false],
    ["watched only", false, true],
    ["saved and watched", true, true],
  ])("%s exposes only usable picks across all tabs", async (label, hasSaved, hasWatched) => {
    let profile = tasteProfileService.createEmptyProfile();
    if (hasSaved) profile = tasteProfileService.toggleWatchlist(profile, movie);
    if (hasWatched) profile = tasteProfileService.toggleSeen(profile, movie);
    reelbotCloudService.bootstrapUserState.mockResolvedValue(snapshot(profile));
    renderLibrary();
    await waitFor(() => expect(lists().getByRole("button", { name: /^Saved/ })).toHaveTextContent(`Saved ${hasSaved ? 1 : 0}`));
    await waitFor(() => expect(lists().getByRole("button", { name: /^Watched/ })).toHaveTextContent(`Watched ${hasWatched ? 1 : 0}`));
    await waitFor(() => expect(screen.queryByText("Saving your changes…")).not.toBeInTheDocument());

    for (const tab of ["Saved", "Watched", "Not for me", "Recent", "Watched", "Saved"]) {
      fireEvent.click(lists().getByRole("button", { name: new RegExp(`^${tab}`) }));
      const shouldRewatch = hasWatched && (tab === "Watched" || !hasSaved);
      const shouldPickSaved = hasSaved && tab !== "Watched";
      expect(Boolean(screen.queryByRole("button", { name: "Pick a rewatch" }))).toBe(shouldRewatch);
      expect(Boolean(screen.queryByRole("button", { name: "Pick from my movies" }))).toBe(shouldPickSaved);
      if (shouldRewatch || shouldPickSaved) {
        fireEvent.click(screen.getByRole("button", { name: shouldRewatch ? "Pick a rewatch" : "Pick from my movies" }));
        expect(openAskReelbot).toHaveBeenLastCalledWith({ prompt: shouldRewatch
          ? "Choose a movie from Watched to rewatch"
          : "choose a movie from my saved list that I have not watched" });
      }
      if (tab === "Watched" && !hasWatched) {
        expect(screen.getByText("Nothing marked as watched yet.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Browse Movies" })).toHaveAttribute("href", "/browse");
        expect(screen.getByRole("link", { name: "Get a pick" })).toHaveAttribute("href", "/#pick-for-me");
      }
    }
    expect(reelbotCloudService.saveUserState).not.toHaveBeenCalled();
  });

  test("removing the last Watched movie immediately removes the rewatch action", async () => {
    renderLibrary();
    await screen.findByRole("heading", { name: movie.title });
    fireEvent.click(lists().getByRole("button", { name: /^Watched/ }));
    expect(screen.getByRole("button", { name: "Pick a rewatch" })).toBeInTheDocument();
    fireEvent.click(statuses().getByRole("button", { name: "Watched" }));
    await screen.findByText("Nothing marked as watched yet.");
    expect(screen.queryByRole("button", { name: "Pick a rewatch" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Saving your changes…")).not.toBeInTheDocument());
    fireEvent.click(lists().getByRole("button", { name: /^Saved/ }));
    expect(screen.getByRole("button", { name: "Pick from my movies" })).toBeInTheDocument();
  });
});


test("opening an empty Watched tab directly does not offer a rewatch", async () => {
  const profile = tasteProfileService.toggleWatchlist(tasteProfileService.createEmptyProfile(), movie);
  reelbotCloudService.bootstrapUserState.mockResolvedValue(snapshot(profile));
  renderLibrary("/my-movies?tab=seen");
  await waitFor(() => expect(lists().getByRole("button", { name: /^Saved/ })).toHaveTextContent("Saved 1"));
  expect(lists().getByRole("button", { name: /^Watched/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("button", { name: "Pick a rewatch" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Browse Movies" })).toBeInTheDocument();
  expect(reelbotCloudService.saveUserState).not.toHaveBeenCalled();
});

test("a failed last-Watched removal restores its rewatch action", async () => {
  let rejectSave;
  reelbotCloudService.saveUserState.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectSave = reject; }));
  renderLibrary("/my-movies?tab=seen");
  await screen.findByRole("heading", { name: movie.title });
  fireEvent.click(statuses().getByRole("button", { name: "Watched" }));
  await screen.findByText("Nothing marked as watched yet.");
  expect(screen.queryByRole("button", { name: "Pick a rewatch" })).not.toBeInTheDocument();
  await waitFor(() => expect(rejectSave).toBeDefined());
  await act(async () => { rejectSave(new Error("Could not save. Try again.")); });
  expect(await screen.findByRole("heading", { name: movie.title })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pick a rewatch" }));
  expect(openAskReelbot).toHaveBeenLastCalledWith({ prompt: "Choose a movie from Watched to rewatch" });
});

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test("authentication restoration shows loading, not a sign-in gate or empty library", () => {
  mockUser = null;
  mockAuthReady = false;
  renderLibrary();
  expect(screen.getByRole("status")).toHaveTextContent("Loading your movies…");
  expect(screen.queryByText("Sign in to see your movies")).not.toBeInTheDocument();
  expect(screen.queryByText("No saved movies yet.")).not.toBeInTheDocument();
  expect(reelbotCloudService.bootstrapUserState).not.toHaveBeenCalled();
});

test("a ready guest gets the sign-in gate without claiming local feedback is a cloud library", () => {
  mockUser = null;
  tasteProfileService.save(tasteProfileService.toggleSeen(tasteProfileService.createEmptyProfile(), movie));
  renderLibrary();
  expect(screen.getByText("Sign in to see your movies")).toBeInTheDocument();
  expect(screen.queryByText("Loading your movies…")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: movie.title })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(mockOpenAuthPrompt).toHaveBeenCalledWith("my_movies_gate");
});

test("cloud restoration never shows saving, false zero counts or empty-library actions", async () => {
  const load = deferred();
  reelbotCloudService.bootstrapUserState.mockReturnValue(load.promise);
  renderLibrary();
  expect(screen.getByRole("status")).toHaveTextContent("Loading your movies…");
  expect(screen.queryByText("Saving your changes…")).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Saved movie lists" })).not.toBeInTheDocument();
  expect(screen.queryByText("No saved movies yet.")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Get a pick" })).not.toBeInTheDocument();
  await act(async () => load.resolve(snapshot(tasteProfileService.createEmptyProfile())));
  expect(screen.getByText("No saved movies yet.")).toBeInTheDocument();
  expect(lists().getByRole("button", { name: /^Saved/ })).toHaveTextContent("Saved 0");
});

test("restoration failure is an actionable error, never an empty library", async () => {
  reelbotCloudService.bootstrapUserState.mockRejectedValue(new Error("Connection interrupted."));
  renderLibrary();
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Your movies couldn’t be loaded.");
  expect(alert).toHaveTextContent("Connection interrupted.");
  expect(alert).toHaveTextContent("Refresh this page to try again.");
  expect(screen.queryByText("No saved movies yet.")).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Saved movie lists" })).not.toBeInTheDocument();
});

test("account switch masks prior library in every committed render, including before restoration effects", async () => {
  const commits = [];
  function ObserveCommit() {
    useLayoutEffect(() => { commits.push({ user: mockUser?.id, text: document.body.textContent }); });
    return <MyMovies />;
  }
  const ui = () => <MemoryRouter><TasteProfileProvider><ObserveCommit /></TasteProfileProvider></MemoryRouter>;
  const view = render(ui());
  await screen.findByRole("heading", { name: movie.title });
  const next = deferred();
  reelbotCloudService.bootstrapUserState.mockReturnValueOnce(next.promise);
  useAskReelbotPageContext.mockClear();
  mockUser = { id: "second-owner" };
  view.rerender(ui());
  expect(commits.filter(commit => commit.user === "second-owner").every(commit => !commit.text.includes(movie.title))).toBe(true);
  expect(useAskReelbotPageContext.mock.calls.every(([context]) => context.savedMovieIds.length === 0 && context.watchedMovieIds.length === 0)).toBe(true);
  expect(screen.getByRole("status")).toHaveTextContent("Loading your movies…");
  await act(async () => next.resolve(snapshot(tasteProfileService.createEmptyProfile())));
  expect(screen.getByText("No saved movies yet.")).toBeInTheDocument();
});

test("a late restoration from a previous account cannot populate the new account library", async () => {
  const oldLoad = deferred();
  reelbotCloudService.bootstrapUserState.mockReturnValueOnce(oldLoad.promise);
  const ui = () => <MemoryRouter><TasteProfileProvider><MyMovies /></TasteProfileProvider></MemoryRouter>;
  const view = render(ui());
  mockUser = { id: "second-owner" };
  reelbotCloudService.bootstrapUserState.mockResolvedValueOnce(snapshot(tasteProfileService.createEmptyProfile()));
  view.rerender(ui());
  await screen.findByText("No saved movies yet.");
  await act(async () => oldLoad.resolve(snapshot(tasteProfileService.toggleWatchlist(tasteProfileService.createEmptyProfile(), movie))));
  expect(screen.queryByRole("heading", { name: movie.title })).not.toBeInTheDocument();
  expect(reelbotCloudService.activateLocalCache.mock.calls.every(([, id]) => id === "second-owner")).toBe(true);
});

test("pick action saves, survives leaving and a fresh return, and keeps Watched separate from Saved", async () => {
  let persisted = tasteProfileService.createEmptyProfile();
  reelbotCloudService.bootstrapUserState.mockImplementation(async () => snapshot(persisted));
  reelbotCloudService.saveUserState.mockImplementation(async (id, next) => { persisted = next; return snapshot(next); });
  function JourneyReady() {
    const { isProfileReady } = useTasteProfile();
    return isProfileReady ? <span>Library ready</span> : null;
  }
  const journey = () => <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TasteProfileProvider>
    <JourneyReady />
    <Routes>
      <Route path="/" element={<><h1>Picked movie</h1><TasteActionBar movie={movie} /><Link to="/my-movies">My movies</Link></>} />
      <Route path="/my-movies" element={<><MyMovies /><Link to="/away">Leave library</Link></>} />
      <Route path="/away" element={<Link to="/my-movies">Return to movies</Link>} />
    </Routes>
  </TasteProfileProvider></MemoryRouter>;
  const view = render(journey());
  await screen.findByText("Library ready");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("button", { name: "Saved" });
  fireEvent.click(screen.getByRole("link", { name: "My movies" }));
  await screen.findByRole("heading", { name: movie.title });
  fireEvent.click(screen.getByRole("link", { name: "Leave library" }));
  fireEvent.click(screen.getByRole("link", { name: "Return to movies" }));
  expect(screen.getByRole("heading", { name: movie.title })).toBeInTheDocument();
  view.unmount();
  renderLibrary();
  await screen.findByRole("heading", { name: movie.title });
  fireEvent.click(statuses().getByRole("button", { name: "Watched" }));
  await waitFor(() => expect(persisted.seen).toHaveLength(1));
  expect(persisted.watchlist).toHaveLength(1);
  expect(persisted.likedVibes).toEqual([]);
  expect(persisted.skipped).toEqual([]);
  fireEvent.click(lists().getByRole("button", { name: /^Watched/ }));
  expect(screen.getByRole("heading", { name: movie.title })).toBeInTheDocument();
});

test("a fresh return retries a failed restoration and recovers the persisted library", async () => {
  reelbotCloudService.bootstrapUserState.mockRejectedValueOnce(new Error("Connection interrupted."));
  const view = renderLibrary();
  await screen.findByRole("alert");
  view.unmount();
  renderLibrary();
  await screen.findByRole("heading", { name: movie.title });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(reelbotCloudService.bootstrapUserState).toHaveBeenCalledTimes(2);
  expect(reelbotCloudService.saveUserState).not.toHaveBeenCalled();
});
