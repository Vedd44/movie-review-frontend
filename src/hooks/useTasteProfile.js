import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PENDING_SAVE_KEY, useAuth } from "../context/AuthContext";
import { reelbotCloudService } from "../services/reelbotCloudService";
import { TASTE_PROFILE_UPDATED_EVENT, tasteProfileService } from "../services/tasteProfileService";

const TasteProfileContext = createContext(null);

function useSharedTasteProfile() {
  const { user, authReady } = useAuth();
  const userId = user?.id || "";
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const [profile, setProfile] = useState(() => reelbotCloudService.getLocalProfileOwner()
    ? tasteProfileService.createEmptyProfile() : tasteProfileService.load());
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState("");
  const profileRef = useRef(profile);
  const queue = useRef(Promise.resolve());
  const ready = useRef(false);
  const generation = useRef(0);

  const applyProfile = useCallback(next => {
    profileRef.current = next;
    setProfile(next);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const version = ++generation.current;
    ready.current = false;
    setSyncError("");
    if (!userId || !reelbotCloudService.isConfigured) {
      reelbotCloudService.clearLocalAccountCache();
      applyProfile(tasteProfileService.load());
      ready.current = true;
      setSyncLoading(false);
      queue.current = Promise.resolve();
      return;
    }
    // Never display the previous account's library during restoration.
    applyProfile(tasteProfileService.createEmptyProfile());
    setSyncLoading(true);
    const isCurrent = () => generation.current === version && activeUser.current === userId;
    queue.current = reelbotCloudService.bootstrapUserState(userId).then(async snapshot => {
      if (!isCurrent()) return;
      let pending = null;
      try { pending = JSON.parse(window.localStorage.getItem(PENDING_SAVE_KEY) || "null"); } catch {}
      if (pending?.id) {
        const previousProfile = snapshot.profile;
        const state = tasteProfileService.getMovieTasteState(previousProfile, pending.id);
        if (!state.inWatchlist) {
          snapshot = await reelbotCloudService.saveUserState(userId,
            tasteProfileService.toggleWatchlist(previousProfile, pending), { ...snapshot, previousProfile });
        }
        if (!isCurrent()) return;
        window.localStorage.removeItem(PENDING_SAVE_KEY);
      }
      reelbotCloudService.activateLocalCache(snapshot, userId);
      applyProfile(snapshot.profile);
      ready.current = true;
    }).catch(error => {
      if (isCurrent()) setSyncError(error.message || "Your movies could not be loaded. Refresh to try again.");
    }).finally(() => {
      if (isCurrent()) setSyncLoading(false);
    });
    return () => { generation.current += 1; };
  }, [authReady, userId, applyProfile]);

  useEffect(() => {
    const syncProfile = event => {
      // Own commits already update this shared provider. Storage events from
      // other tabs are safe only when the cache belongs to this same account.
      if (event.type !== "storage" && userId) return;
      if (reelbotCloudService.getLocalProfileOwner() !== userId) return;
      applyProfile(tasteProfileService.load());
    };
    window.addEventListener("storage", syncProfile);
    window.addEventListener(TASTE_PROFILE_UPDATED_EVENT, syncProfile);
    return () => {
      window.removeEventListener("storage", syncProfile);
      window.removeEventListener(TASTE_PROFILE_UPDATED_EVENT, syncProfile);
    };
  }, [userId, applyProfile]);

  const commit = useCallback((updater, options = {}) => {
    const version = generation.current;
    const perform = async () => {
      if (activeUser.current !== userId || generation.current !== version) return profileRef.current;
      if (userId && !ready.current) throw new Error("Your movies haven't finished syncing. Refresh to try again.");
      const previousProfile = profileRef.current;
      const previousInteractions = tasteProfileService.loadInteractions();
      const nextProfile = typeof updater === "function" ? updater(previousProfile) : updater;
      const persisted = tasteProfileService.save(nextProfile);
      applyProfile(persisted);
      if (!userId || !reelbotCloudService.isConfigured) return persisted;
      if (!options.quiet) setSyncLoading(true);
      try {
        const snapshot = await reelbotCloudService.saveUserState(userId, persisted, { ...options, previousProfile });
        if (activeUser.current !== userId || generation.current !== version) return snapshot.profile;
        reelbotCloudService.activateLocalCache(snapshot, userId);
        applyProfile(snapshot.profile);
        if (!options.quiet) setSyncError("");
        return snapshot.profile;
      } catch (error) {
        if (activeUser.current === userId && generation.current === version) {
          tasteProfileService.save(previousProfile);
          tasteProfileService.saveInteractions(previousInteractions);
          applyProfile(previousProfile);
          if (!options.quiet) setSyncError(error.message || "That change couldn't be saved. Please try again.");
        }
        throw error;
      } finally {
        if (!options.quiet && activeUser.current === userId && generation.current === version) setSyncLoading(false);
      }
    };
    // One queue for every Save button, route and recommendation interaction.
    const operation = queue.current.then(perform, perform);
    queue.current = operation.catch(() => {});
    return operation;
  }, [userId, applyProfile]);

  useEffect(() => {
    if (!userId) return undefined;
    const record = ({ detail }) => {
      const { name, properties = {} } = detail || {};
      // Identification answers share Home's result event but are not
      // recommendation outcomes (and must never be coerced into failures).
      if (properties.kind === "identification" || properties.outcome === "identification") return;
      const isPick = name === "recommendation_returned" || (name === "ask_reelbot_result" && properties.kind === "recommendation");
      const isFailure = name === "recommendation_failed" || name === "ask_reelbot_failed";
      if (!isPick && !isFailure) return;
      if (name === "ask_reelbot_failed" && properties.kind !== "recommendation") return;
      void commit(profile => tasteProfileService.recordRequestOutcome(profile, {
        outcome: properties.outcome || (isPick ? "pick" : "failed"),
        latency_ms: properties.latency_ms,
        surface: properties.page || (name.startsWith("ask_") ? "ask" : "home"),
      }), { quiet: true }).catch(() => {});
    };
    window.addEventListener("reelbot:analytics", record);
    return () => window.removeEventListener("reelbot:analytics", record);
  }, [commit, userId]);

  const actions = useMemo(
    () => ({
      toggleWatchlist: (movie) => commit((currentProfile) => tasteProfileService.toggleWatchlist(currentProfile, movie)),
      toggleSeen: (movie, options) => commit((currentProfile) => tasteProfileService.toggleSeen(currentProfile, movie, options)),
      toggleSkipped: (movie, options) => commit((currentProfile) => tasteProfileService.toggleSkipped(currentProfile, movie, options)),
      toggleLikedVibe: (movie, vibeLabel) => commit((currentProfile) => tasteProfileService.toggleLikedVibe(currentProfile, movie, vibeLabel)),
      addRecentMovie: (movie) => commit((currentProfile) => tasteProfileService.addRecentMovie(currentProfile, movie)),
      savePickPreferences: (preferences) => commit((currentProfile) => tasteProfileService.savePickPreferences(currentProfile, preferences)),
      recordPickResult: (preferences, payload) => commit((currentProfile) => tasteProfileService.recordPickResult(currentProfile, preferences, payload)),
      clearActiveHomePick: (movieIds = []) => commit(
        (currentProfile) => tasteProfileService.clearActiveHomePick(currentProfile, movieIds),
        { homePickSession: null }
      ),
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

export function TasteProfileProvider({ children }) {
  const value = useSharedTasteProfile();
  return <TasteProfileContext.Provider value={value}>{children}</TasteProfileContext.Provider>;
}

export default function useTasteProfile() {
  const value = useContext(TasteProfileContext);
  if (!value) throw new Error("useTasteProfile requires TasteProfileProvider");
  return value;
}
