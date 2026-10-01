import { act, render, screen, waitFor } from "@testing-library/react";
import useTasteProfile, { TasteProfileProvider } from "./useTasteProfile";
import { reelbotCloudService } from "../services/reelbotCloudService";
import { tasteProfileService } from "../services/tasteProfileService";
let mockUser = { id: "account-a" };
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: mockUser, authReady: true }), PENDING_SAVE_KEY: "reelbotPendingMovieSave" }));
jest.mock("../services/reelbotCloudService", () => ({ reelbotCloudService: {
  isConfigured: true, getLocalProfileOwner: jest.fn(() => ""), clearLocalAccountCache: jest.fn(),
  bootstrapUserState: jest.fn(), saveUserState: jest.fn(), activateLocalCache: jest.fn(),
} }));
const empty = () => ({ profile: tasteProfileService.createEmptyProfile(), interactions: [], homePickSession: null });
let first, second;
function First() { first = useTasteProfile(); return <span data-testid="first">{first.profile.watchlist.map(movie => movie.id).join(",")}</span>; }
function Second() { second = useTasteProfile(); return <span data-testid="second">{second.profile.watchlist.map(movie => movie.id).join(",")}</span>; }
const app = () => <TasteProfileProvider><First /><Second /></TasteProfileProvider>;
beforeEach(() => {
  window.localStorage.clear(); jest.clearAllMocks(); mockUser = { id: "account-a" };
  reelbotCloudService.bootstrapUserState.mockResolvedValue(empty());
  reelbotCloudService.saveUserState.mockImplementation(async (id, profile) => ({ ...empty(), profile }));
});
async function ready() { await waitFor(() => expect(first.isCloudSyncing).toBe(false)); }

test("all consumers bootstrap once and serialize concurrent saves without losing either movie", async () => {
  render(app()); await ready();
  expect(reelbotCloudService.bootstrapUserState).toHaveBeenCalledTimes(1);
  await act(async () => { await Promise.all([
    first.actions.toggleWatchlist({ id: 1, title: "First" }),
    second.actions.toggleWatchlist({ id: 2, title: "Second" }),
  ]); });
  expect(screen.getByTestId("first")).toHaveTextContent("2,1");
  expect(screen.getByTestId("second")).toHaveTextContent("2,1");
  expect(reelbotCloudService.saveUserState.mock.calls[1][2].previousProfile.watchlist.map(movie => movie.id)).toEqual([1]);
});

test("a failed save rolls back consistently, then a later save can succeed", async () => {
  reelbotCloudService.saveUserState.mockRejectedValueOnce(new Error("Offline"));
  render(app()); await ready();
  await act(async () => { await expect(first.actions.toggleWatchlist({ id: 1, title: "One" })).rejects.toThrow("Offline"); });
  expect(first.savedCounts.watchlist).toBe(0); expect(second.cloudSyncError).toBe("Offline");
  await act(async () => { await second.actions.toggleWatchlist({ id: 2, title: "Two" }); });
  expect(first.savedCounts.watchlist).toBe(1); expect(first.cloudSyncError).toBe("");
});

test("a late save response cannot overwrite a different account", async () => {
  let finish;
  reelbotCloudService.saveUserState.mockImplementationOnce((id, profile) => new Promise(resolve => { finish = () => resolve({ ...empty(), profile }); }));
  const view = render(app()); await ready();
  let operation;
  await act(async () => { operation = first.actions.toggleWatchlist({ id: 1, title: "A's movie" }); });
  mockUser = { id: "account-b" }; view.rerender(app()); await ready();
  await act(async () => { finish(); await operation; });
  expect(first.profile.watchlist).toEqual([]);
  expect(reelbotCloudService.activateLocalCache.mock.calls.at(-1)[1]).toBe("account-b");
});

test("pending anonymous Save is applied once to the restored account", async () => {
  window.localStorage.setItem("reelbotPendingMovieSave", JSON.stringify({ id: 7, title: "Seven" }));
  render(app()); await ready();
  expect(first.profile.watchlist.map(movie => movie.id)).toEqual([7]);
  expect(reelbotCloudService.saveUserState).toHaveBeenCalledTimes(1);
  expect(window.localStorage.getItem("reelbotPendingMovieSave")).toBeNull();
});


test("request telemetry is quiet and a failed measurement cannot lose a queued Save", async () => {
  render(app()); await ready();
  let rejectTelemetry;
  reelbotCloudService.saveUserState.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectTelemetry = reject; }));
  await act(async () => window.dispatchEvent(new CustomEvent("reelbot:analytics", { detail: { name: "recommendation_returned", properties: { latency_ms: 4200, page: "home", outcome: "pick" } } })));
  await waitFor(() => expect(rejectTelemetry).toBeDefined());
  expect(first.isCloudSyncing).toBe(false);
  let save;
  await act(async () => { save = first.actions.toggleWatchlist({ id: 11, title: "Still saved" }); rejectTelemetry(new Error("Telemetry failed")); await save; });
  expect(first.profile.watchlist.map(movie => movie.id)).toEqual([11]);
  expect(first.cloudSyncError).toBe("");
});
