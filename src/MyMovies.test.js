import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyMovies from "./MyMovies";
import { TasteProfileProvider } from "./hooks/useTasteProfile";
import { reelbotCloudService } from "./services/reelbotCloudService";
import { tasteProfileService } from "./services/tasteProfileService";

const mockUser = { id: "library-owner" };
jest.mock("./context/AuthContext", () => ({ useAuth: () => ({ user: mockUser, authReady: true }), PENDING_SAVE_KEY: "pending-save" }));
jest.mock("./context/AskReelbotContext", () => ({ useAskReelbotPageContext: jest.fn(), openAskReelbot: jest.fn() }));
jest.mock("./seo", () => ({ usePageMetadata: jest.fn(), buildBreadcrumbJsonLd: jest.fn() }));
jest.mock("./services/reelbotCloudService", () => ({ reelbotCloudService: {
  isConfigured: true, getLocalProfileOwner: jest.fn(() => ""), clearLocalAccountCache: jest.fn(),
  bootstrapUserState: jest.fn(), saveUserState: jest.fn(), activateLocalCache: jest.fn(),
} }));

const movie = { id: 23168, title: "The Town", release_date: "2010-09-15" };
const snapshot = (profile) => ({ profile, interactions: [], homePickSession: null });
const renderLibrary = () => render(
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
