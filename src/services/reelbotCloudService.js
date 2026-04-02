import { normalizeInteractions } from "../behavioralMemory";
import { getSupabaseClient, isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { tasteProfileService } from "./tasteProfileService";

const REMOTE_SESSION_KEY = "reelbot_state";
const MIGRATION_MARKER_KEY = "reelbotSupabaseMigration";

const dedupeById = (items = []) => {
  const seenIds = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const movieId = Number(item?.id || 0);
    if (!movieId || seenIds.has(movieId)) {
      return false;
    }

    seenIds.add(movieId);
    return true;
  });
};

const dedupeByKey = (items = [], keyBuilder) => {
  const seenKeys = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const itemKey = keyBuilder(item);
    if (!itemKey || seenKeys.has(itemKey)) {
      return false;
    }

    seenKeys.add(itemKey);
    return true;
  });
};

const byNewestFirst = (left, right) => {
  const leftValue = new Date(left?.saved_at || left?.timestamp || 0).getTime() || 0;
  const rightValue = new Date(right?.saved_at || right?.timestamp || 0).getTime() || 0;
  return rightValue - leftValue;
};

const mergeMovieLists = (primary = [], secondary = []) =>
  dedupeById([...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])]).sort(byNewestFirst);

const mergeInteractions = (primary = [], secondary = []) =>
  dedupeByKey(
    normalizeInteractions([...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])]),
    (entry) => `${entry.type}:${entry.timestamp}:${entry.movie?.id || "none"}`
  );

const mergePickHistory = (primary = [], secondary = []) =>
  dedupeByKey(
    [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])],
    (entry) => `${entry.signature}:${(entry.movie_ids || []).join(",")}`
  );

const mergeLikedVibes = (primary = [], secondary = []) =>
  dedupeByKey([...(Array.isArray(primary) ? primary : []), ...(Array.isArray(secondary) ? secondary : [])], (entry) => entry?.key || "");

const pickMoreRecentSession = (primary, secondary) => {
  const primaryStamp = new Date(primary?.saved_at || 0).getTime() || 0;
  const secondaryStamp = new Date(secondary?.saved_at || 0).getTime() || 0;
  return primaryStamp >= secondaryStamp ? primary : secondary;
};

const statusToBucket = {
  saved: "watchlist",
  seen: "seen",
  hidden: "skipped",
};

const bucketToStatus = {
  watchlist: "saved",
  seen: "seen",
  skipped: "hidden",
};

const buildSessionPayload = ({ profile, interactions, homePickSession }) => ({
  profile: {
    recentMovies: profile?.recentMovies || [],
    recentRecommendations: profile?.recentRecommendations || [],
    likedVibes: profile?.likedVibes || [],
    pickHistory: profile?.pickHistory || [],
    lastPickPreferences: profile?.lastPickPreferences || null,
    lastResolvedIntent: profile?.lastResolvedIntent || null,
  },
  interactions: normalizeInteractions(interactions || []),
  homePickSession: homePickSession || null,
});

const buildMovieRows = (userId, profile = {}) =>
  ["watchlist", "seen", "skipped"].flatMap((bucket) =>
    (profile?.[bucket] || []).map((movie) => ({
      user_id: userId,
      movie_id: Number(movie?.id || 0),
      status: bucketToStatus[bucket],
      movie_data: movie,
      created_at: movie?.saved_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
  ).filter((row) => row.movie_id && row.status);

const isMissingMovieDataColumnError = (error) =>
  /movie_data/i.test(String(error?.message || ""))
  && /does not exist|column/i.test(String(error?.message || ""));

const buildFallbackMovieSnapshot = (row = {}) => {
  const movieId = Number(row.movie_id || 0) || null;

  return {
    id: movieId,
    title: row.title || row.name || `Movie ${movieId || ""}`.trim() || "Saved movie",
    poster_path: row.poster_path || null,
    release_date: row.release_date || "",
    vote_average: Number(row.vote_average || 0) || 0,
    runtime: Number(row.runtime || 0) || null,
    overview: row.overview || "",
    genre_ids: Array.isArray(row.genre_ids) ? row.genre_ids : [],
    genre_names: Array.isArray(row.genre_names) ? row.genre_names : [],
    saved_at: row.created_at || null,
  };
};

const selectUserMovieRows = async (client, userId) => {
  const preferredResponse = await client
    .from("user_movies")
    .select("movie_id, status, movie_data, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!preferredResponse.error) {
    return {
      rows: preferredResponse.data || [],
      includesMovieData: true,
    };
  }

  if (!isMissingMovieDataColumnError(preferredResponse.error)) {
    throw preferredResponse.error;
  }

  const fallbackResponse = await client
    .from("user_movies")
    .select("movie_id, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (fallbackResponse.error) {
    throw fallbackResponse.error;
  }

  return {
    rows: fallbackResponse.data || [],
    includesMovieData: false,
  };
};

const mergeRemoteAndLocalState = (remoteState, localState) => {
  const remoteProfile = remoteState?.profile || tasteProfileService.createEmptyProfile();
  const localProfile = localState?.profile || tasteProfileService.createEmptyProfile();

  const mergedProfile = tasteProfileService.rebuildProfile({
    ...remoteProfile,
    watchlist: mergeMovieLists(remoteProfile.watchlist, localProfile.watchlist),
    seen: mergeMovieLists(remoteProfile.seen, localProfile.seen),
    skipped: mergeMovieLists(remoteProfile.skipped, localProfile.skipped),
    recentMovies: mergeMovieLists(remoteProfile.recentMovies, localProfile.recentMovies).slice(0, 18),
    recentRecommendations: mergeMovieLists(remoteProfile.recentRecommendations, localProfile.recentRecommendations).slice(0, 30),
    likedVibes: mergeLikedVibes(remoteProfile.likedVibes, localProfile.likedVibes).slice(0, 24),
    pickHistory: mergePickHistory(remoteProfile.pickHistory, localProfile.pickHistory).slice(0, 18),
    lastPickPreferences: localProfile.lastPickPreferences || remoteProfile.lastPickPreferences || null,
    lastResolvedIntent: localProfile.lastResolvedIntent || remoteProfile.lastResolvedIntent || null,
  });

  return {
    profile: mergedProfile,
    interactions: mergeInteractions(remoteState?.interactions, localState?.interactions).slice(0, 80),
    homePickSession: pickMoreRecentSession(remoteState?.homePickSession, localState?.homePickSession) || null,
  };
};

const mirrorLocalCache = ({ profile, interactions, homePickSession }) => {
  tasteProfileService.save(profile);
  tasteProfileService.saveInteractions(interactions || []);
  tasteProfileService.saveHomePickSession(homePickSession || null);
};

const fetchRemoteSnapshot = async (userId) => {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return {
      profile: tasteProfileService.createEmptyProfile(),
      interactions: [],
      homePickSession: null,
    };
  }

  const client = getSupabaseClient();
  const [{ rows: movieRows, includesMovieData }, { data: sessionRow, error: sessionError }] = await Promise.all([
    selectUserMovieRows(client, userId),
    client
      .from("user_sessions")
      .select("payload, last_prompt, last_pick_id, created_at, updated_at")
      .eq("user_id", userId)
      .eq("session_key", REMOTE_SESSION_KEY)
      .maybeSingle(),
  ]);

  if (sessionError) {
    throw sessionError;
  }

  const payload = sessionRow?.payload && typeof sessionRow.payload === "object" ? sessionRow.payload : {};
  const bucketedMovies = {
    watchlist: [],
    seen: [],
    skipped: [],
  };

  (movieRows || []).forEach((row) => {
    const bucket = statusToBucket[row.status];
    if (!bucket) {
      return;
    }

    const movieSnapshot = includesMovieData
      ? {
          ...(row.movie_data && typeof row.movie_data === "object" ? row.movie_data : {}),
          id: Number(row.movie_id || row.movie_data?.id || 0) || null,
          saved_at: row.created_at || row.movie_data?.saved_at || null,
        }
      : buildFallbackMovieSnapshot(row);

    bucketedMovies[bucket].push(movieSnapshot);
  });

  return {
    profile: tasteProfileService.rebuildProfile({
      ...tasteProfileService.createEmptyProfile(),
      watchlist: bucketedMovies.watchlist,
      seen: bucketedMovies.seen,
      skipped: bucketedMovies.skipped,
      recentMovies: payload.profile?.recentMovies || [],
      recentRecommendations: payload.profile?.recentRecommendations || [],
      likedVibes: payload.profile?.likedVibes || [],
      pickHistory: payload.profile?.pickHistory || [],
      lastPickPreferences: payload.profile?.lastPickPreferences || null,
      lastResolvedIntent: payload.profile?.lastResolvedIntent || null,
    }),
    interactions: normalizeInteractions(payload.interactions || []),
    homePickSession: payload.homePickSession || null,
  };
};

const writeRemoteSnapshot = async (userId, snapshot) => {
  const client = getSupabaseClient();
  const normalizedProfile = tasteProfileService.rebuildProfile(snapshot?.profile || tasteProfileService.createEmptyProfile());
  const movieRows = buildMovieRows(userId, normalizedProfile);
  const activeMovieIds = movieRows.map((row) => row.movie_id);

  if (movieRows.length) {
    const { error } = await client.from("user_movies").upsert(movieRows, { onConflict: "user_id,movie_id" });
    if (error) {
      throw error;
    }
  }

  const { data: existingRows, error: existingRowsError } = await client
    .from("user_movies")
    .select("id, movie_id")
    .eq("user_id", userId);

  if (existingRowsError) {
    throw existingRowsError;
  }

  const removableIds = (existingRows || [])
    .filter((row) => !activeMovieIds.includes(Number(row.movie_id || 0)))
    .map((row) => row.id);

  if (removableIds.length) {
    const { error } = await client.from("user_movies").delete().in("id", removableIds);
    if (error) {
      throw error;
    }
  }

  const sessionPayload = buildSessionPayload({
    profile: normalizedProfile,
    interactions: snapshot?.interactions || [],
    homePickSession: snapshot?.homePickSession || null,
  });

  const { error: sessionWriteError } = await client.from("user_sessions").upsert({
    user_id: userId,
    session_key: REMOTE_SESSION_KEY,
    last_prompt: String(normalizedProfile.lastPickPreferences?.prompt || snapshot?.homePickSession?.originalPrompt || "").trim() || null,
    last_pick_id: Number(snapshot?.homePickSession?.currentPick?.primary?.id || 0) || null,
    payload: sessionPayload,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,session_key" });

  if (sessionWriteError) {
    throw sessionWriteError;
  }

  mirrorLocalCache({
    profile: normalizedProfile,
    interactions: snapshot?.interactions || [],
    homePickSession: snapshot?.homePickSession || null,
  });

  if (typeof window !== "undefined") {
    window.localStorage.setItem(MIGRATION_MARKER_KEY, JSON.stringify({
      user_id: userId,
      synced_at: new Date().toISOString(),
    }));
  }

  return {
    profile: normalizedProfile,
    interactions: snapshot?.interactions || [],
    homePickSession: snapshot?.homePickSession || null,
  };
};

export const reelbotCloudService = {
  isConfigured: isSupabaseConfigured,
  async loadUserState(userId) {
    return fetchRemoteSnapshot(userId);
  },
  async saveUserState(userId, profile, options = {}) {
    if (!isSupabaseConfigured || !supabase || !userId) {
      return {
        profile: tasteProfileService.rebuildProfile(profile || tasteProfileService.createEmptyProfile()),
        interactions: options.interactions || tasteProfileService.loadInteractions(),
        homePickSession: options.homePickSession || tasteProfileService.loadHomePickSession(),
      };
    }

    return writeRemoteSnapshot(userId, {
      profile,
      interactions: options.interactions || tasteProfileService.loadInteractions(),
      homePickSession: options.homePickSession || tasteProfileService.loadHomePickSession(),
    });
  },
  async bootstrapUserState(userId) {
    const remoteState = await fetchRemoteSnapshot(userId);
    const localState = {
      profile: tasteProfileService.load(),
      interactions: tasteProfileService.loadInteractions(),
      homePickSession: tasteProfileService.loadHomePickSession(),
    };
    const mergedState = mergeRemoteAndLocalState(remoteState, localState);
    return writeRemoteSnapshot(userId, mergedState);
  },
};
