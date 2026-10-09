import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminPanel from "./AdminPanel";
import { getSupabaseClient } from "./lib/supabaseClient";

jest.mock("./context/AuthContext", () => ({ useAuth: () => ({ user: { id: "admin", app_metadata: { role: "super_admin" } }, authReady: true }) }));
jest.mock("./lib/supabaseClient", () => ({ getSupabaseClient: jest.fn() }));
jest.mock("./seo", () => ({ usePageMetadata: jest.fn() }));

const originalFetch = global.fetch;
const initialTime = "2026-10-09T16:00:00.000Z";
const response = total => ({ ok: true, json: async () => ({ stats: { total_users: total }, users: [], activity: [], feedback: [] }) });
const app = () => <MemoryRouter><AdminPanel /></MemoryRouter>;
const snapshotTime = () => screen.getByRole("time").dateTime;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(initialTime));
  window.localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue(response(101));
  getSupabaseClient.mockResolvedValue({ auth: { getSession: async () => ({ data: { session: { access_token: "test-only-token" } } }) } });
});

afterEach(() => {
  jest.useRealTimers();
  global.fetch = originalFetch;
});

test("shows when the uncached snapshot was fetched and does not poll", async () => {
  render(app());
  await screen.findByText("101");
  expect(global.fetch).toHaveBeenCalledWith("/api/admin-overview?hide_mine=1&hide_admins=0", expect.objectContaining({ cache: "no-store", signal: expect.anything() }));
  const fetchedAt = snapshotTime();
  expect(fetchedAt).toBe(new Date().toISOString());
  expect(screen.getByText(/This page does not update automatically/)).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(5 * 60 * 1000); });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(snapshotTime()).toBe(fetchedAt);
});

test("a failed manual refresh retains the dated snapshot and a successful retry replaces it", async () => {
  render(app());
  await screen.findByText("101");
  const fetchedAt = snapshotTime();
  global.fetch.mockRejectedValueOnce(new Error("Connection unavailable"));
  jest.setSystemTime(new Date("2026-10-09T16:05:00.000Z"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Refresh failed");
  expect(screen.getByRole("alert")).toHaveTextContent("Showing the previous snapshot. It may be out of date.");
  expect(screen.getByText("101")).toBeInTheDocument();
  expect(snapshotTime()).toBe(fetchedAt);

  global.fetch.mockResolvedValueOnce(response(202));
  jest.setSystemTime(new Date("2026-10-09T16:06:00.000Z"));
  fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
  await screen.findByText("202");
  expect(snapshotTime()).toBe(new Date().toISOString());
  expect(snapshotTime()).not.toBe(fetchedAt);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText("101")).not.toBeInTheDocument();
});

test("an initial load failure does not claim to have a previous snapshot", async () => {
  global.fetch.mockRejectedValueOnce(new Error("Connection unavailable"));
  render(app());
  expect(await screen.findByRole("alert")).toHaveTextContent("Admin data unavailable");
  expect(screen.queryByText(/Snapshot fetched/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Showing the previous snapshot/)).not.toBeInTheDocument();
});

test("changing the owner filter clears the old snapshot until the new filter is fetched", async () => {
  render(app());
  await screen.findByText("101");
  let finish;
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Hide my activity" }));
  await waitFor(() => expect(finish).toBeDefined());
  expect(screen.queryByText("101")).not.toBeInTheDocument();
  expect(screen.queryByText(/Snapshot fetched/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Refreshing…" })).toBeDisabled();
  jest.setSystemTime(new Date("2026-10-09T16:07:00.000Z"));
  await act(async () => { finish(response(303)); });
  expect(global.fetch).toHaveBeenLastCalledWith("/api/admin-overview?hide_mine=0&hide_admins=0", expect.objectContaining({ cache: "no-store" }));
  expect(screen.getByText("303")).toBeInTheDocument();
  expect(snapshotTime()).toBe("2026-10-09T16:07:00.000Z");
});

test("a superseded refresh cannot replace the current filter snapshot", async () => {
  render(app());
  await screen.findByText("101");
  let finishOldRefresh;
  global.fetch.mockImplementationOnce(() => new Promise(resolve => { finishOldRefresh = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
  await waitFor(() => expect(finishOldRefresh).toBeDefined());
  const oldSignal = global.fetch.mock.calls[1][1].signal;
  global.fetch.mockResolvedValueOnce(response(303));
  fireEvent.click(screen.getByRole("checkbox", { name: "Hide my activity" }));
  await screen.findByText("303");
  const currentSnapshotTime = snapshotTime();
  expect(oldSignal.aborted).toBe(true);
  jest.setSystemTime(new Date("2026-10-09T16:08:00.000Z"));
  await act(async () => { finishOldRefresh(response(202)); });
  expect(screen.getByText("303")).toBeInTheDocument();
  expect(screen.queryByText("202")).not.toBeInTheDocument();
  expect(snapshotTime()).toBe(currentSnapshotTime);
});
