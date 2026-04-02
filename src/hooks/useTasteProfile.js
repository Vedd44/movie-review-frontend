import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { reelbotCloudService } from "../services/reelbotCloudService";
import { TASTE_PROFILE_UPDATED_EVENT, tasteProfileService } from "../services/tasteProfileService";

function useTasteProfile() {
  const [profile, setProfile] = useState(() => tasteProfileService.load());
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState("");
  const { user, authReady } = useAuth();
  const profileRef = useRef(profile);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    const syncProfile = () => {
      if (user) {
        return;
      }

      setProfile(tasteProfileService.load());
    };

    window.addEventListener("storage", syncProfile);
    window.addEventListener(TASTE_PROFILE_UPDATED_EVENT, syncProfile);

    return () => {
      window.removeEventListener("storage", syncProfile);
      window.removeEventListener(TASTE_PROFILE_UPDATED_EVENT, syncProfile);
    };
  }, [user]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!user || !reelbotCloudService.isConfigured) {
      setProfile(tasteProfileService.load());
      setSyncLoading(false);
      setSyncError("");
      return;
    }

    let cancelled = false;
    setSyncLoading(true);
    setSyncError("");

    reelbotCloudService.bootstrapUserState(user.id)
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        setProfile(snapshot.profile);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error("Error bootstrapping ReelBot cloud state:", error);
        setSyncError(error.message || "Could not sync your ReelBot data.");
      })
      .finally(() => {
        if (!cancelled) {
          setSyncLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  const commit = useCallback(async (updater) => {
    const previousProfile = profileRef.current;
    const previousInteractions = tasteProfileService.loadInteractions();
    const nextProfile = typeof updater === "function" ? updater(previousProfile) : updater;
    const persistedProfile = tasteProfileService.save(nextProfile);

    profileRef.current = persistedProfile;
    setProfile(persistedProfile);

    if (!user || !reelbotCloudService.isConfigured) {
      setSyncError("");
      return persistedProfile;
    }

    setSyncLoading(true);

    try {
      const snapshot = await reelbotCloudService.saveUserState(user.id, persistedProfile);
      profileRef.current = snapshot.profile;
      setProfile(snapshot.profile);
      setSyncError("");
      return snapshot.profile;
    } catch (error) {
      console.error("Error saving ReelBot cloud state:", error);
      tasteProfileService.save(previousProfile);
      tasteProfileService.saveInteractions(previousInteractions);
      profileRef.current = previousProfile;
      setProfile(previousProfile);
      setSyncError(error.message || "Could not sync your latest ReelBot changes.");
      throw error;
    } finally {
      setSyncLoading(false);
    }
  }, [user]);

  const actions = useMemo(
    () => ({
      toggleWatchlist: (movie) => commit((currentProfile) => tasteProfileService.toggleWatchlist(currentProfile, movie)),
      toggleSeen: (movie) => commit((currentProfile) => tasteProfileService.toggleSeen(currentProfile, movie)),
      toggleSkipped: (movie) => commit((currentProfile) => tasteProfileService.toggleSkipped(currentProfile, movie)),
      toggleLikedVibe: (movie, vibeLabel) => commit((currentProfile) => tasteProfileService.toggleLikedVibe(currentProfile, movie, vibeLabel)),
      addRecentMovie: (movie) => commit((currentProfile) => tasteProfileService.addRecentMovie(currentProfile, movie)),
      savePickPreferences: (preferences) => commit((currentProfile) => tasteProfileService.savePickPreferences(currentProfile, preferences)),
      recordPickResult: (preferences, payload) => commit((currentProfile) => tasteProfileService.recordPickResult(currentProfile, preferences, payload)),
      recordSwapFeedback: (movie, preferences, metadata) => commit((currentProfile) => tasteProfileService.recordSwapFeedback(currentProfile, movie, preferences, metadata)),
      recordDetailView: (movie, metadata) => commit((currentProfile) => tasteProfileService.recordDetailView(currentProfile, movie, metadata)),
      recordProviderClick: (movie, provider, metadata) => commit((currentProfile) => tasteProfileService.recordProviderClick(currentProfile, movie, provider, metadata)),
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

  const getRecommendationContextForMovie = useCallback(
    (movieId) => tasteProfileService.getRecommendationContextForMovie(profile, movieId),
    [profile]
  );

  const getSavedMoviesForBucket = useCallback(
    (bucket) => tasteProfileService.getSavedMoviesForBucket(profile, bucket),
    [profile]
  );

  const savedCounts = useMemo(() => tasteProfileService.getSavedCounts(profile), [profile]);
  const behavioralMemory = useMemo(() => tasteProfileService.buildBehavioralMemoryPayload(profile), [profile]);

  return {
    profile,
    behavioralMemory,
    actions,
    isCloudSyncing: syncLoading,
    cloudSyncError: syncError,
    isUsingCloudProfile: Boolean(user),
    getMovieState,
    getPickExcludedIds,
    getRecommendationContextForMovie,
    getSavedMoviesForBucket,
    savedCounts,
  };
}

export default useTasteProfile;
