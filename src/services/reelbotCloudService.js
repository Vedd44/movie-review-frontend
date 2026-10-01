import { normalizeInteractions } from "../behavioralMemory";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient";
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

export const buildMovieRows = (userId, profile = {}) => {
  const rows = new Map();
  const savedIds = new Set((profile.watchlist || []).map(movie => Number(movie.id)));
  ["watchlist", "seen", "skipped"].forEach(bucket => (profile[bucket] || []).forEach(movie => {
    const id = Number(movie.id);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    rows.set(id, {
      user_id: userId, movie_id: id, status: bucketToStatus[bucket],
      movie_data: { ...movie, saved_to_watchlist: savedIds.has(id) },
      created_at: movie.saved_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }));
  return [...rows.values()];
};

export const buildMovieChanges = (userId, profile, previousProfile = {}) => {
  const previous = new Map(buildMovieRows(userId, previousProfile).map(row => [row.movie_id, row]));
  const next = buildMovieRows(userId, profile);
  const nextIds = new Set(next.map(row => row.movie_id));
  return {
    upserts: next.filter(row => {
      const before = previous.get(row.movie_id);
      return !before || before.status !== row.status || JSON.stringify(before.movie_data) !== JSON.stringify(row.movie_data);
    }),
    removedIds: [...previous.keys()].filter(id => !nextIds.has(id)),
  };
};

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
  const rows = [];
  let includesMovieData = true;
  for (let offset = 0; ; offset += 500) {
    const response = await client.from("user_movies")
      .select(includesMovieData ? "movie_id, status, movie_data, created_at" : "movie_id, status, created_at")
      .eq("user_id", userId).order("movie_id").range(offset, offset + 499);
    if (response.error) {
      if (includesMovieData && isMissingMovieDataColumnError(response.error)) {
        includesMovieData = false;
        offset -= 500;
        continue;
      }
      throw response.error;
    }
    rows.push(...(response.data || []));
    if ((response.data || []).length < 500) break;
  }
  return { rows, includesMovieData };
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

export const getLocalProfileOwner = () => {
  try { return JSON.parse(window.localStorage.getItem(MIGRATION_MARKER_KEY) || "null")?.user_id || ""; }
  catch { return ""; }
};

const mirrorLocalCache = ({ profile, interactions, homePickSession }, userId = "") => {
  window.localStorage.setItem(MIGRATION_MARKER_KEY, JSON.stringify({ user_id: userId }));
  tasteProfileService.save(profile);
  tasteProfileService.saveInteractions(interactions || []);
  tasteProfileService.saveHomePickSession(homePickSession || null);
};

const fetchRemoteSnapshot = async (userId) => {
  if (!isSupabaseConfigured || !userId) {
    return {
      profile: tasteProfileService.createEmptyProfile(),
      interactions: [],
      homePickSession: null,
    };
  }

  const client = await getSupabaseClient();
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
    if (bucket === "seen" && row.movie_data?.saved_to_watchlist) bucketedMovies.watchlist.push(movieSnapshot);
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

const writeRemoteSnapshot = async (userId, snapshot, previousProfile) => {
  const client = await getSupabaseClient();
  const profile = tasteProfileService.rebuildProfile(snapshot.profile);
  const { upserts, removedIds } = buildMovieChanges(userId, profile, previousProfile);
  // Session metadata contains no saved lists. A failed session write must not
  // roll back an already successful library change.
  const { error: sessionError } = await client.from("user_sessions").upsert({
    user_id: userId, session_key: REMOTE_SESSION_KEY,
    last_prompt: String(profile.lastPickPreferences?.prompt || snapshot.homePickSession?.originalPrompt || "").trim() || null,
    last_pick_id: Number(snapshot.homePickSession?.currentPick?.primary?.id || 0) || null,
    payload: buildSessionPayload({ ...snapshot, profile }),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,session_key" });
  if (sessionError) throw sessionError;
  if (upserts.length) {
    const { error } = await client.from("user_movies").upsert(upserts, { onConflict: "user_id,movie_id" });
    if (error) throw error;
  }
  // Delete only movies explicitly removed by this action, never rows absent
  // from a possibly stale client snapshot.
  if (removedIds.length) {
    const { error } = await client.from("user_movies").delete().eq("user_id", userId).in("movie_id", removedIds);
    if (error) throw error;
  }
  return { ...snapshot, profile };
};

export const reelbotCloudService = {
  isConfigured: isSupabaseConfigured,
  getLocalProfileOwner,
  activateLocalCache: mirrorLocalCache,
  clearLocalAccountCache() {
    if (!getLocalProfileOwner()) return;
    mirrorLocalCache({ profile: tasteProfileService.createEmptyProfile(), interactions: [], homePickSession: null });
    window.localStorage.removeItem("reelbot:taste-profile:v1");
    window.sessionStorage.removeItem("reelbot:session-recommendations:v1");
  },
  async loadUserState(userId) {
    return fetchRemoteSnapshot(userId);
  },
  async saveUserState(userId, profile, options = {}) {
    if (!isSupabaseConfigured || !userId) {
      return {
        profile: tasteProfileService.rebuildProfile(profile || tasteProfileService.createEmptyProfile()),
        interactions: options.interactions || tasteProfileService.loadInteractions(),
        homePickSession: Object.prototype.hasOwnProperty.call(options, "homePickSession")
          ? options.homePickSession
          : tasteProfileService.loadHomePickSession(),
      };
    }

    return writeRemoteSnapshot(userId, {
      profile,
      interactions: options.interactions || tasteProfileService.loadInteractions(),
      homePickSession: Object.prototype.hasOwnProperty.call(options, "homePickSession")
        ? options.homePickSession
        : tasteProfileService.loadHomePickSession(),
    }, options.previousProfile);
  },
  async bootstrapUserState(userId) {
    const owner = getLocalProfileOwner();
    const localState = {
      profile: tasteProfileService.load(),
      interactions: tasteProfileService.loadInteractions(),
      homePickSession: tasteProfileService.loadHomePickSession(),
    };
    const remoteState = await fetchRemoteSnapshot(userId);
    // Guest data migrates once. An account cache is never merged into another
    // account, or resurrected over changes made on another device.
    if (owner) return remoteState;
    const mergedState = mergeRemoteAndLocalState(remoteState, localState);
    return writeRemoteSnapshot(userId, mergedState, remoteState.profile);
  },
};
