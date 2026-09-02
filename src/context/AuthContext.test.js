import { completePendingMovieSave, PENDING_SAVE_KEY } from "./AuthContext";
import { tasteProfileService } from "../services/tasteProfileService";

beforeEach(() => {
  window.localStorage.clear();
  tasteProfileService.save(tasteProfileService.createEmptyProfile());
});

test("completes an intended anonymous save after authentication", () => {
  const movie = { id: 348, title: "Alien", poster_path: "/alien.jpg" };
  window.localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(movie));
  expect(completePendingMovieSave()).toEqual(movie);
  expect(tasteProfileService.getMovieTasteState(tasteProfileService.load(), 348).inWatchlist).toBe(true);
  expect(window.localStorage.getItem(PENDING_SAVE_KEY)).toBeNull();
});
