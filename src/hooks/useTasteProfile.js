import { useCallback, useEffect, useMemo, useState } from "react";
import { TASTE_PROFILE_UPDATED_EVENT, tasteProfileService } from "../services/tasteProfileService";

function useTasteProfile() {
  const [profile, setProfile] = useState(() => tasteProfileService.load());

  useEffect(() => {
    const syncProfile = () => {
      setProfile(tasteProfileService.load());
    };

    window.addEventListener("storage", syncProfile);
    window.addEventListener(TASTE_PROFILE_UPDATED_EVENT, syncProfile);

    return () => {
      window.removeEventListener("storage", syncProfile);
      window.removeEventListener(TASTE_PROFILE_UPDATED_EVENT, syncProfile);
    };
  }, []);

  const commit = useCallback((updater) => {
    setProfile((previousProfile) => {
      const nextProfile = typeof updater === "function" ? updater(previousProfile) : updater;
      tasteProfileService.save(nextProfile);
      return nextProfile;
    });
  }, []);

  const actions = useMemo(
    () => ({
      toggleWatchlist: (movie) => commit((currentProfile) => tasteProfileService.toggleWatchlist(currentProfile, movie)),
      toggleSeen: (movie) => commit((currentProfile) => tasteProfileService.toggleSeen(currentProfile, movie)),
      toggleSkipped: (movie) => commit((currentProfile) => tasteProfileService.toggleSkipped(currentProfile, movie)),
      toggleLikedVibe: (movie, vibeLabel) => commit((currentProfile) => tasteProfileService.toggleLikedVibe(currentProfile, movie, vibeLabel)),
      addRecentMovie: (movie) => commit((currentProfile) => tasteProfileService.addRecentMovie(currentProfile, movie)),
      savePickPreferences: (preferences) => commit((currentProfile) => tasteProfileService.savePickPreferences(currentProfile, preferences)),
      recordPickResult: (preferences, payload) => commit((currentProfile) => tasteProfileService.recordPickResult(currentProfile, preferences, payload)),
    }),
    [commit]
  );

  const getMovieState = useCallback(
    (movieId, vibeLabel = "") => tasteProfileService.getMovieTasteState(profile, movieId, vibeLabel),
    [profile]
  );

  const getPickExcludedIds = useCallback(
    (preferences, extraIds = []) => tasteProfileService.getPickExcludedIds(profile, preferences, extraIds),
    [profile]
  );

  const getSavedMoviesForBucket = useCallback(
    (bucket) => tasteProfileService.getSavedMoviesForBucket(profile, bucket),
    [profile]
  );

  const savedCounts = useMemo(() => tasteProfileService.getSavedCounts(profile), [profile]);

  return {
    profile,
    actions,
    getMovieState,
    getPickExcludedIds,
    getSavedMoviesForBucket,
    savedCounts,
  };
}

export default useTasteProfile;
