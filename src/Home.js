import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./App.css";
import {
  API_BASE_URL,
  MOOD_FILTERS,
  REELBOT_CAPABILITIES,
  VIEW_OPTIONS,
  formatMovieDate,
  getFeedPath,
  getReleaseYear,
  getViewLabel,
  getMoviePath,
} from "./discovery";
import PickResultPanel from "./components/PickResultPanel";
import ReelbotPromptComposer from "./components/ReelbotPromptComposer";
import TrailerModal from "./components/TrailerModal";
import { hasBehavioralSignals, scoreMovieForBehavioralMemory } from "./behavioralMemory";
import { useAuth } from "./context/AuthContext";
import useTasteProfile from "./hooks/useTasteProfile";
import { buildRecommendationRationale, getBackupRoleLabel } from "./recommendationInsights";
import { buildSwapQueueFromPayload, dedupeIds, getPickSessionMovieIds, mergeSwapQueue, normalizePickPayload, promoteQueuedPick } from "./reelbotSession";
import { buildBreadcrumbJsonLd, buildItemListJsonLd, usePageMetadata } from "./seo";
import { buildAbsoluteUrl, DEFAULT_SOCIAL_IMAGE, SITE_DESCRIPTION, SITE_NAME } from "./siteConfig";
import { homeFeedService } from "./services/homeFeedService";
import { tasteProfileService } from "./services/tasteProfileService";

const DYNAMIC_HEADLINE_PROMPTS = [
  "What are you in the mood for?",
  "What should I watch?",
  "Find something worth watching",
  "Let’s find your next watch",
];

const PICK_LOADING_MESSAGES = [
  "Scanning the library…",
  "Evaluating candidates…",
  "Ranking the best match…",
];

const HOMEPAGE_PROMPT_POOL = [
  "Something visually stunning but not slow",
  "Dark but not depressing",
  "Feel-good but not cheesy",
  "Smart but still easy to follow",
  "Fast-paced but not exhausting",
  "Movie to watch while half-paying attention",
  "Something for a Sunday afternoon",
  "Late night, don't want to think too hard",
  "Background movie that still holds up",
  "Good to watch with parents",
  "Something everyone will agree on",
  "Easy watch with friends",
  "Under 90 minutes",
  "Something newer but not mainstream",
  "Critically good but not heavy",
  "A movie that makes you think after it ends",
  "Something you probably haven't seen but should",
  "A comfort rewatch that always works",
  "A movie that starts slow but pays off",
  "A tense thriller that isn't bleak",
  "Funny without feeling dumb",
  "Big emotions, still easy to get into",
  "A stylish action movie with actual story",
  "A rainy-night movie",
  "Something cozy but not sleepy",
  "One of those 'how have I never seen this?' movies",
  "A movie with great chemistry",
  "Something gripping from the first 10 minutes",
  "A crowd-pleaser that still feels smart",
  "Great soundtrack, great mood",
  "Something twisty but not confusing",
  "A low-stress movie night pick",
  "A sharp thriller under two hours",
  "Easy sci-fi that still feels clever",
  "A great first-watch with someone",
  "Something heartfelt without wrecking me",
  "A movie that feels bigger than it is",
  "Lighter than a drama, smarter than a comedy",
  "A comfort movie for a rough day",
  "Something adventurous but not too loud",
  "An underrated movie with real payoff",
  "Visually rich and easy to sink into",
];

const HOMEPAGE_PROMPT_COUNT = 4;
const PROMPT_ROTATION_MS = 12000;
const MIN_CURATED_FEED_SIZE = 8;
const HOMEPAGE_DESKTOP_COLUMNS = 5;
const HOMEPAGE_BASE_DISPLAY_COUNT = 15;
const HOMEPAGE_EXPANDED_DISPLAY_COUNT = 20;
const HOMEPAGE_MAX_RELEASE_WINDOW_DAYS = 210;
const SWAP_SOFT_EXHAUSTION_THRESHOLD = 4;
const SOFT_SWAP_MESSAGE = "Want more options? Try refining your vibe or browse more movies.";
const EXPANDED_SWAP_LOADING_MESSAGE = "Expanding the search a bit…";
const RESTORE_STATUS_TIMEOUT_MS = 1000;
const SWAP_LOADING_MESSAGE = "Finding another strong option…";
const PICK_REQUEST_FALLBACK_MESSAGE = "We couldn’t land a strong pick from that prompt. Try refining the vibe or browse more movies.";
const PICK_REQUEST_ERROR_MESSAGE = "ReelBot could not pull a pick right now.";
const SWAP_REQUEST_ERROR_MESSAGE = "We couldn’t swap in a stronger alternative right now. Your last pick is still here.";
const PICK_REFINE_ACTIONS = [
  { id: "lighter", label: "Lighter", loadingMessage: "Looking for something a little lighter…" },
  { id: "darker", label: "Darker", loadingMessage: "Taking this in a darker direction…" },
  { id: "shorter", label: "Shorter", loadingMessage: "Tightening the runtime a bit…" },
  { id: "more_like_this", label: "More like this", loadingMessage: "Staying close to this pick…" },
  { id: "different_angle", label: "Different angle", loadingMessage: "Trying a nearby angle…" },
];

const PICK_VARIATION_SEQUENCE = [
  { id: "tone_gritty", dimension: "tone", emphasis: "gritty", description: "Lean into a grittier tone" },
  { id: "tone_polished", dimension: "tone", emphasis: "polished", description: "Lean into a more polished tone" },
  { id: "pacing_fast", dimension: "pacing", emphasis: "fast", description: "Push a faster, choppier pace" },
  { id: "pacing_measured", dimension: "pacing", emphasis: "measured", description: "Stay measured and deliberate" },
  { id: "scale_contained", dimension: "scale", emphasis: "contained", description: "Keep the scale more contained" },
  { id: "scale_expansive", dimension: "scale", emphasis: "expansive", description: "Lean toward a more expansive scale" },
  { id: "access_easy", dimension: "accessibility", emphasis: "easy", description: "Highlight easier, accessible energy" },
  { id: "access_demanding", dimension: "accessibility", emphasis: "demanding", description: "Lean into a more demanding watch" },
  { id: "violence_stylized", dimension: "violence", emphasis: "stylized", description: "Treat the violence as stylized" },
  { id: "violence_harsh", dimension: "violence", emphasis: "harsh", description: "Treat the violence as harsh" },
];

const getVariationFocusFromIndex = (index = 0) => {
  if (!PICK_VARIATION_SEQUENCE.length) {
    return null;
  }

  const safeIndex = ((Math.floor(index) % PICK_VARIATION_SEQUENCE.length) + PICK_VARIATION_SEQUENCE.length) % PICK_VARIATION_SEQUENCE.length;
  const entry = PICK_VARIATION_SEQUENCE[safeIndex];
  return {
    index: safeIndex,
    id: entry.id,
    dimension: entry.dimension,
    emphasis: entry.emphasis,
    description: entry.description,
  };
};

const PICK_STATUS = {
  IDLE: "idle",
  RESTORING: "restoring",
  LOADING: "loading",
  LOADING_SWAP: "loading_swap",
  READY: "ready",
  EXHAUSTED: "exhausted",
  ERROR: "error",
};

const PICK_REFRESH_EXHAUSTION_THRESHOLD = 3;

const HOMEPAGE_USER_STATE = {
  NEW: "new",
  SESSION: "session",
  AUTHENTICATED: "authenticated",
};

const ONBOARDING_COMPLETED_STORAGE_KEY = "reelbotOnboardingCompleted";
const ONBOARDING_DISMISSED_SESSION_KEY = "reelbotOnboardingDismissed";
const FIRST_PICK_SUMMARY_SEEN_STORAGE_KEY = "reelbotHasSeenFirstPickSummary";

const FEED_METADATA = {
  latest: {
    title: "Now Playing Movies | ReelBot",
    description: "See what’s in theaters now, then let ReelBot help narrow the best pick.",
    path: "/now-playing",
    heading: "Now Playing & Trending",
  },
  popular: {
    title: "Trending Movies | ReelBot",
    description: "Browse trending movie picks, then use ReelBot to narrow what to watch next.",
    path: "/trending",
    heading: "Trending This Week",
  },
  upcoming: {
    title: "Coming Soon Movies | ReelBot",
    description: "See upcoming releases and use ReelBot to track what’s worth watching next.",
    path: "/coming-soon",
    heading: "Coming Soon",
  },
};

const ONBOARDING_TASTE_FEED_VIEWS = ["latest", "popular"];
const ONBOARDING_POSTER_TARGET = 8;
const ONBOARDING_MIN_SIGNAL_COUNT = 5;
const ONBOARDING_VIBES = [
  {
    id: "easy_fun",
    label: "Something easy / fun",
    shortLabel: "Easy / fun",
    promptLead: "Pick an easy, fun movie that feels immediately watchable and not too heavy.",
    deckGenres: [35, 12, 16, 10751, 10749, 14],
  },
  {
    id: "intense",
    label: "Something intense",
    shortLabel: "Intense",
    promptLead: "Pick something intense with real tension, urgency, or emotional pressure.",
    deckGenres: [53, 80, 28, 27, 9648, 18],
  },
  {
    id: "thought_provoking",
    label: "Something thought-provoking",
    shortLabel: "Thought-provoking",
    promptLead: "Pick something thought-provoking that feels smart, distinctive, and worth talking about after.",
    deckGenres: [878, 9648, 18, 99, 36, 14],
  },
  {
    id: "emotional",
    label: "Emotional",
    shortLabel: "Emotional",
    promptLead: "Pick something emotional that feels grounded, character-first, and worth sitting with.",
    deckGenres: [18, 10749, 10402, 36],
  },
  {
    id: "surprise_me",
    label: "Surprise me",
    shortLabel: "Surprise me",
    promptLead: "Pick one strong surprise recommendation that still feels broadly crowd-pleasing and worth the time.",
    deckGenres: [12, 878, 53, 35, 18, 16],
  },
];

const ONBOARDING_BUCKETS = [
  { id: "easy_fun", genreIds: [35, 16, 10751, 10749, 12], fallbackTag: "Easy watch" },
  { id: "intense", genreIds: [53, 80, 28, 27], fallbackTag: "Intense" },
  { id: "thought_provoking", genreIds: [878, 9648, 18, 99, 36], fallbackTag: "Thought-provoking" },
  { id: "adventurous", genreIds: [12, 14, 878, 28], fallbackTag: "Big world" },
  { id: "emotional", genreIds: [18, 10749, 10402], fallbackTag: "Emotional" },
  { id: "offbeat", genreIds: [14, 16, 9648], fallbackTag: "Distinctive" },
];

const pickDynamicHeadline = () => DYNAMIC_HEADLINE_PROMPTS[Math.floor(Math.random() * DYNAMIC_HEADLINE_PROMPTS.length)];

const readLocalFlag = (key) => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(key) === "true";
};

const readSessionFlag = (key) => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(key) === "true";
};

const writeLocalFlag = (key, value) => {
  if (typeof window === "undefined") {
    return;
  }

  if (value) {
    window.localStorage.setItem(key, "true");
    return;
  }

  window.localStorage.removeItem(key);
};

const writeSessionFlag = (key, value) => {
  if (typeof window === "undefined") {
    return;
  }

  if (value) {
    window.sessionStorage.setItem(key, "true");
    return;
  }

  window.sessionStorage.removeItem(key);
};

const shuffleArray = (items = []) => {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[randomIndex]] = [nextItems[randomIndex], nextItems[index]];
  }

  return nextItems;
};

const pickPromptSuggestions = (pool, count, excludedItems = []) => {
  const excludedSet = new Set(excludedItems);
  const availableItems = pool.filter((item) => !excludedSet.has(item));
  const workingPool = availableItems.length >= count ? availableItems : pool;
  return shuffleArray(workingPool).slice(0, count);
};

const getDaysSinceRelease = (releaseDate) => {
  if (!releaseDate) {
    return Number.POSITIVE_INFINITY;
  }

  const parsedDate = new Date(releaseDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((Date.now() - parsedDate.getTime()) / (1000 * 60 * 60 * 24));
};

const isRecentRelease = (releaseDate, days = 45) => {
  const daysSinceRelease = getDaysSinceRelease(releaseDate);
  return Number.isFinite(daysSinceRelease) && daysSinceRelease >= 0 && daysSinceRelease <= days;
};

const isHighConfidenceCuratedMovie = (movie, view) => {
  const voteCount = Number(movie?.vote_count || 0);
  const voteAverage = Number(movie?.vote_average || 0);
  const popularity = Number(movie?.popularity || 0);
  const daysSinceRelease = getDaysSinceRelease(movie?.release_date);
  const sourceType = movie?.source_type || movie?.homepage_feed_source || view;

  if (!movie?.poster_path) {
    return false;
  }

  if (view === "latest") {
    return (
      (sourceType === "now_playing" || sourceType === "latest") &&
      daysSinceRelease <= 90 &&
      voteAverage >= 6.4 &&
      (voteCount >= 120 || popularity >= 55)
    );
  }

  if (view === "popular") {
    return voteAverage >= 6.3 && (voteCount >= 240 || popularity >= 85);
  }

  return voteAverage >= 6.2 && (voteCount >= 80 || popularity >= 45);
};

const trimMoviesToDisplayCount = (items = [], view = "latest") => {
  const expandedCandidates = items.slice(0, HOMEPAGE_EXPANDED_DISPLAY_COUNT);
  const highConfidenceExpandedCount = expandedCandidates.filter((movie) => isHighConfidenceCuratedMovie(movie, view)).length;

  if (expandedCandidates.length >= HOMEPAGE_EXPANDED_DISPLAY_COUNT && highConfidenceExpandedCount >= 18) {
    return expandedCandidates;
  }

  if (items.length >= HOMEPAGE_BASE_DISPLAY_COUNT) {
    return items.slice(0, HOMEPAGE_BASE_DISPLAY_COUNT);
  }

  const fallbackCount = Math.floor(items.length / HOMEPAGE_DESKTOP_COLUMNS) * HOMEPAGE_DESKTOP_COLUMNS;
  return items.slice(0, fallbackCount);
};

const passesFeedQualityCheck = (movie, view) => {
  if (!movie?.poster_path) {
    return false;
  }

  const voteCount = Number(movie.vote_count || 0);
  const voteAverage = Number(movie.vote_average || 0);
  const popularity = Number(movie.popularity || 0);
  const daysSinceRelease = getDaysSinceRelease(movie.release_date);
  const sourceType = movie.source_type || movie.homepage_feed_source || view;

  if (view === "upcoming") {
    return popularity >= 8 || getDaysSinceRelease(movie.release_date) <= 45;
  }

  if (voteCount >= 25 && voteAverage > 0 && voteAverage < 5.9) {
    return false;
  }

  if (voteCount < 18 && popularity < 24) {
    return false;
  }

  if (view === "latest" && voteCount < 35 && popularity < 28) {
    return false;
  }

  if (view === "latest") {
    if (voteAverage > 0 && voteAverage < 6.1 && voteCount >= 20) {
      return false;
    }

    if (voteCount < 55 && popularity < 38) {
      return false;
    }

    if (daysSinceRelease > 75 && popularity < 52 && voteCount < 140) {
      return false;
    }
  }

  if (view === "popular" && voteCount < 45 && popularity < 42) {
    return false;
  }

  if (sourceType === "popular" && daysSinceRelease > HOMEPAGE_MAX_RELEASE_WINDOW_DAYS && popularity < 82 && voteCount < 260) {
    return false;
  }

  if (daysSinceRelease > 120 && voteAverage > 0 && voteAverage < 6.4 && popularity < 44) {
    return false;
  }

  return true;
};

const getFeedCurationScore = (movie, view) => {
  const voteCount = Number(movie.vote_count || 0);
  const voteAverage = Number(movie.vote_average || 0);
  const popularity = Number(movie.popularity || 0);
  const daysSinceRelease = getDaysSinceRelease(movie.release_date);
  const sourceType = movie.source_type || movie.homepage_feed_source || view;
  const ratingScore = voteAverage > 0 ? voteAverage * 11 : 0;
  const popularityScore = Math.min(popularity, 160) * 0.82;
  const engagementScore = Math.min(voteCount, 2400) / 24;
  const posterBoost = movie.poster_path ? 12 : 0;
  const nowPlayingBoost = sourceType === "now_playing" ? 30 : 0;
  const trendingBoost = sourceType === "popular" ? 24 : 0;
  const recognizabilityBoost =
    voteCount >= 1200 ? 16 : voteCount >= 450 ? 11 : voteCount >= 180 ? 6 : popularity >= 75 ? 5 : 0;
  const releaseWindowBoost =
    !Number.isFinite(daysSinceRelease)
      ? 0
      : daysSinceRelease <= 30
        ? 34
        : daysSinceRelease <= 60
          ? 24
          : daysSinceRelease <= 120
            ? 16
            : daysSinceRelease <= HOMEPAGE_MAX_RELEASE_WINDOW_DAYS
              ? 6
              : -8;
  const latestCredibilityBoost =
    view === "latest"
      ? voteCount >= 300
        ? 14
        : voteCount >= 120
          ? 9
          : popularity >= 60
            ? 5
            : -10
      : 0;
  const trendingMomentumBoost =
    view === "popular"
      ? popularity >= 110
        ? 14
        : popularity >= 85
          ? 10
          : voteCount >= 350
            ? 6
            : 0
      : 0;
  const lowSignalPenalty =
    voteCount < 60 && popularity < 42
      ? 18
      : voteCount < 100 && popularity < 52
        ? 8
        : 0;

  return (
    posterBoost +
    ratingScore +
    popularityScore +
    engagementScore +
    nowPlayingBoost +
    trendingBoost +
    recognizabilityBoost +
    releaseWindowBoost +
    latestCredibilityBoost +
    trendingMomentumBoost -
    lowSignalPenalty
  );
};

const getHomepageCardLabel = (movie, view) => {
  const voteCount = Number(movie.vote_count || 0);
  const voteAverage = Number(movie.vote_average || 0);
  const popularity = Number(movie.popularity || 0);
  const sourceType = movie.source_type || movie.homepage_feed_source || view;

  if (sourceType === "now_playing" && isRecentRelease(movie.release_date, 35)) {
    return "New Release";
  }

  if (sourceType === "popular" || popularity >= 90) {
    return "Trending";
  }

  if (voteCount >= 500 || (voteCount >= 180 && popularity >= 55)) {
    return "Popular Now";
  }

  if (voteAverage >= 7.1 && voteCount >= 80) {
    return "Worth a Look";
  }

  return "Worth a Look";
};

const hasGenreMatch = (movie, genreIds = []) => genreIds.some((genreId) => movie?.genre_ids?.includes(genreId));

const formatTitleList = (movies = [], maxItems = 3) => {
  const titles = (Array.isArray(movies) ? movies : [])
    .map((movie) => String(movie?.title || "").trim())
    .filter(Boolean)
    .slice(0, maxItems);

  if (!titles.length) {
    return "";
  }

  if (titles.length === 1) {
    return titles[0];
  }

  if (titles.length === 2) {
    return `${titles[0]} and ${titles[1]}`;
  }

  return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
};

const getOnboardingBucketOrder = (vibeId = "") => {
  const preferredOrder = {
    easy_fun: ["easy_fun", "adventurous", "offbeat", "emotional", "thought_provoking", "intense"],
    intense: ["intense", "thought_provoking", "adventurous", "emotional", "offbeat", "easy_fun"],
    thought_provoking: ["thought_provoking", "intense", "offbeat", "emotional", "adventurous", "easy_fun"],
    emotional: ["emotional", "thought_provoking", "easy_fun", "offbeat", "intense", "adventurous"],
    surprise_me: ["adventurous", "thought_provoking", "easy_fun", "intense", "offbeat", "emotional"],
  };
  const order = preferredOrder[vibeId] || preferredOrder.surprise_me;
  return order.map((bucketId) => ONBOARDING_BUCKETS.find((bucket) => bucket.id === bucketId)).filter(Boolean);
};

const getPosterToneTag = (movie, vibeId = "") => {
  const genreNames = Array.isArray(movie?.genre_names) ? movie.genre_names : [];
  const bucketTag = getOnboardingBucketOrder(vibeId).find((bucket) => hasGenreMatch(movie, bucket.genreIds))?.fallbackTag;
  if (bucketTag) {
    return bucketTag;
  }

  if (genreNames.length) {
    return genreNames[0];
  }

  return "Tonight pick";
};

const buildOnboardingPosterDeck = (movies = [], vibeId = "surprise_me", view = "latest") => {
  const dedupedMovies = dedupeIds((Array.isArray(movies) ? movies : []).map((movie) => movie?.id))
    .map((movieId) => (Array.isArray(movies) ? movies : []).find((movie) => Number(movie?.id) === Number(movieId)))
    .filter((movie) => movie?.id && movie?.poster_path);

  if (!dedupedMovies.length) {
    return [];
  }

  const sortedPool = [...dedupedMovies].sort((leftMovie, rightMovie) => getFeedCurationScore(rightMovie, view) - getFeedCurationScore(leftMovie, view));
  const selectedMovies = [];
  const selectedIds = new Set();
  const selectedGenreIds = new Set();

  const commitMovie = (movie) => {
    if (!movie?.id || selectedIds.has(movie.id)) {
      return false;
    }

    selectedMovies.push(movie);
    selectedIds.add(movie.id);
    (Array.isArray(movie.genre_ids) ? movie.genre_ids : []).forEach((genreId) => selectedGenreIds.add(genreId));
    return true;
  };

  getOnboardingBucketOrder(vibeId).forEach((bucket) => {
    if (selectedMovies.length >= ONBOARDING_POSTER_TARGET) {
      return;
    }

    const match = sortedPool.find((movie) => !selectedIds.has(movie.id) && hasGenreMatch(movie, bucket.genreIds));
    if (match) {
      commitMovie(match);
    }
  });

  sortedPool.forEach((movie) => {
    if (selectedMovies.length >= ONBOARDING_POSTER_TARGET || selectedIds.has(movie.id)) {
      return;
    }

    const introducesNewGenre = (Array.isArray(movie.genre_ids) ? movie.genre_ids : []).some((genreId) => !selectedGenreIds.has(genreId));
    if (introducesNewGenre || selectedMovies.length < 3) {
      commitMovie(movie);
    }
  });

  sortedPool.forEach((movie) => {
    if (selectedMovies.length < ONBOARDING_POSTER_TARGET) {
      commitMovie(movie);
    }
  });

  return selectedMovies.slice(0, ONBOARDING_POSTER_TARGET);
};

const buildOnboardingPrompt = ({ vibe, likedMovies = [], dislikedMovies = [] }) => {
  const promptParts = [vibe?.promptLead || ONBOARDING_VIBES[3].promptLead];
  const likedTitles = formatTitleList(likedMovies, 3);
  const dislikedTitles = formatTitleList(dislikedMovies, 2);

  if (likedTitles) {
    promptParts.push(`Positive signals: the user was interested in ${likedTitles}.`);
  }

  if (dislikedTitles) {
    promptParts.push(`Avoid leaning toward movies closer to ${dislikedTitles}.`);
  }

  promptParts.push("Return one strong first recommendation, not a generic safe pick.");
  return promptParts.join(" ");
};

const countNames = (movies = []) => {
  const counts = new Map();

  (Array.isArray(movies) ? movies : []).forEach((movie) => {
    const names = Array.isArray(movie?.genre_names) && movie.genre_names.length
      ? movie.genre_names
      : Array.isArray(movie?.genre_ids)
        ? movie.genre_ids.map((genreId) => ONBOARDING_BUCKETS.find((bucket) => bucket.genreIds.includes(genreId))?.fallbackTag).filter(Boolean)
        : [];

    names.forEach((name) => {
      counts.set(name, (counts.get(name) || 0) + 1);
    });
  });

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
};

const formatGenreCue = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized.toLowerCase();
};

const buildOnboardingReasoningCopy = ({ vibe, likedMovies = [], dislikedMovies = [], activePick }) => {
  const likedGenre = formatGenreCue(countNames(likedMovies)[0]?.[0] || "");
  const dislikedGenre = formatGenreCue(countNames(dislikedMovies)[0]?.[0] || "");

  if (vibe?.id === "easy_fun") {
    return dislikedGenre
      ? `Keeps the mood easy and clear, without drifting into the ${dislikedGenre} lane you passed on.`
      : "Keeps the mood easy and clear, with enough personality to feel like a real pick.";
  }

  if (vibe?.id === "intense") {
    return likedGenre
      ? `Leans into the darker, higher-pressure movies you kept picking, with real pull from the start.`
      : "Leans into tension and momentum, not just noise.";
  }

  if (vibe?.id === "thought_provoking") {
    return likedGenre
      ? `Stays close to the smarter, more idea-driven picks you reacted to.`
      : "Feels smart and specific without getting lost in itself.";
  }

  if (vibe?.id === "surprise_me") {
    return likedGenre
      ? `A clean surprise pick that still lines up with the ${likedGenre} side of your taste.`
      : "A strong wildcard that still feels intentional.";
  }

  if (vibe?.id === "emotional") {
    return likedGenre
      ? `Leans into the more character-driven picks you kept choosing, without going flat or cold.`
      : "Leans emotional, but still has shape and momentum.";
  }

  if (likedGenre && dislikedGenre) {
    return `Pulls toward ${likedGenre} without circling back to the ${dislikedGenre} picks you ruled out.`;
  }

  if (likedGenre) {
    return `Pulls toward the ${likedGenre} side of your taste.`;
  }

  return "Feels close to the shape of what you picked.";
};

const normalizeFeedMovies = (items = [], view = "latest") =>
  (Array.isArray(items) ? items : []).map((movie) => ({
    ...movie,
    homepage_feed_source: movie?.source_type || movie?.homepage_feed_source || view,
  }));

const getInitialFeedState = (view = "latest", page = 1) => {
  const cachedSnapshot = homeFeedService.getCachedFeedSnapshot(view, page);
  const cachedMovies = normalizeFeedMovies(cachedSnapshot?.payload?.results || [], view);

  return {
    movies: cachedMovies,
    totalPages: Number(cachedSnapshot?.payload?.total_pages || 1),
    loading: !cachedMovies.length,
    refreshing: Boolean(cachedMovies.length),
    error: null,
  };
};

function Home({ routeView = "latest", isFeedRoute = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, openAuthPrompt } = useAuth();
  const initialPickSessionRef = useRef(null);
  const initialFeedStateRef = useRef(null);

  if (initialPickSessionRef.current === null) {
    initialPickSessionRef.current = tasteProfileService.loadHomePickSession() || {};
  }

  if (initialFeedStateRef.current === null) {
    initialFeedStateRef.current = getInitialFeedState(routeView, 1);
  }

  const initialPickSession = initialPickSessionRef.current;
  const initialFeedState = initialFeedStateRef.current;
  const hasInitialLocalSession = Boolean(
    initialPickSession?.currentPick?.primary
      || String(initialPickSession?.originalPrompt || "").trim()
      || (Array.isArray(initialPickSession?.swapHistory) && initialPickSession.swapHistory.length)
  );
  const hasCompletedOnboardingRef = useRef(readLocalFlag(ONBOARDING_COMPLETED_STORAGE_KEY));
  const hasDismissedOnboardingRef = useRef(readSessionFlag(ONBOARDING_DISMISSED_SESSION_KEY));

  const [query, setQuery] = useState("");
  const [homeHeadline] = useState(() => pickDynamicHeadline());
  const [movies, setMovies] = useState(() => initialFeedState.movies);
  const [loading, setLoading] = useState(() => initialFeedState.loading);
  const [isFeedRefreshing, setIsFeedRefreshing] = useState(() => initialFeedState.refreshing);
  const [error, setError] = useState(() => initialFeedState.error);
  const [movieType, setMovieType] = useState(routeView);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(() => initialFeedState.totalPages);
  const [selectedMood, setSelectedMood] = useState("all");
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [pickPrompt, setPickPrompt] = useState(() => String(initialPickSession.originalPrompt || ""));
  const [originalPickPrompt, setOriginalPickPrompt] = useState(() => String(initialPickSession.originalPrompt || ""));
  const [activePromptSuggestion, setActivePromptSuggestion] = useState("");
  const [pickError, setPickError] = useState(null);
  const [pickValidation, setPickValidation] = useState("");
  const [pickResult, setPickResult] = useState(() => initialPickSession.currentPick || null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => hasCompletedOnboardingRef.current);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => hasDismissedOnboardingRef.current);
  const [hasSeenFirstPickSummary, setHasSeenFirstPickSummary] = useState(() => readLocalFlag(FIRST_PICK_SUMMARY_SEEN_STORAGE_KEY));
  const [isFirstPickIntroActive, setIsFirstPickIntroActive] = useState(false);
  const [onboardingFeedMovies, setOnboardingFeedMovies] = useState([]);
  const [onboardingStep, setOnboardingStep] = useState(() => (initialPickSession.currentPick?.primary ? "complete" : "intent"));
  const [onboardingVibeId, setOnboardingVibeId] = useState(() => String(initialPickSession.onboardingVibeId || ""));
  const [onboardingLikedIds, setOnboardingLikedIds] = useState(() => (Array.isArray(initialPickSession.onboardingLikedIds) ? initialPickSession.onboardingLikedIds : []));
  const [onboardingDislikedIds, setOnboardingDislikedIds] = useState(() => (Array.isArray(initialPickSession.onboardingDislikedIds) ? initialPickSession.onboardingDislikedIds : []));
  const [onboardingSkippedIds, setOnboardingSkippedIds] = useState(() => (Array.isArray(initialPickSession.onboardingSkippedIds) ? initialPickSession.onboardingSkippedIds : []));
  const [onboardingResultActive, setOnboardingResultActive] = useState(() => Boolean(initialPickSession.currentPick?.primary));
  const [isVibeEditorOpen, setIsVibeEditorOpen] = useState(false);
  const [isPickComposerOpen, setIsPickComposerOpen] = useState(false);
  const [isPickTrailerOpen, setIsPickTrailerOpen] = useState(false);
  const [swapHistory, setSwapHistory] = useState(() => (Array.isArray(initialPickSession.swapHistory) ? initialPickSession.swapHistory : []));
  const [swapQueue, setSwapQueue] = useState(() => (Array.isArray(initialPickSession.swapQueue) ? initialPickSession.swapQueue : []));
  const [lastPickMode, setLastPickMode] = useState(() => (initialPickSession.lastPickMode === "surprise" ? "surprise" : "prompt"));
  const [swapCount, setSwapCount] = useState(() => Number(initialPickSession.swapCount || 0));
  const [variationIndex, setVariationIndex] = useState(0);
  const [candidatePoolIds, setCandidatePoolIds] = useState(() => (Array.isArray(initialPickSession.candidatePool) ? initialPickSession.candidatePool : []));
  const [refinementState, setRefinementState] = useState(() => initialPickSession.refinementState || null);
  const [hasExpandedSwapPool, setHasExpandedSwapPool] = useState(() => Boolean(initialPickSession.hasExpandedSwapPool));
  const [pickStatus, setPickStatus] = useState(() => (initialPickSession.currentPick?.primary ? PICK_STATUS.RESTORING : PICK_STATUS.IDLE));
  const [pickLoadingMessageOverride, setPickLoadingMessageOverride] = useState("");
  const [visiblePromptSuggestions, setVisiblePromptSuggestions] = useState(() => pickPromptSuggestions(HOMEPAGE_PROMPT_POOL, HOMEPAGE_PROMPT_COUNT));
  const pickResultSectionRef = useRef(null);
  const restoreStatusTimeoutRef = useRef(null);
  const pickRequestVersionRef = useRef(0);
  const restoreVersionRef = useRef(0);
  const [isCompactHeroPreview, setIsCompactHeroPreview] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 560px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 560px)");
    const handleChange = (event) => setIsCompactHeroPreview(event.matches);

    setIsCompactHeroPreview(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const { profile, behavioralMemory, actions: tasteActions, getPickExcludedIds } = useTasteProfile();
  const isPickLoading = pickStatus === PICK_STATUS.LOADING;
  const isSwapLoading = pickStatus === PICK_STATUS.LOADING_SWAP;
  const isPickBusy = isPickLoading || isSwapLoading;

  const getStickyOffset = useCallback(() => (window.matchMedia("(max-width: 720px)").matches ? 88 : 112), []);

  const scrollToNode = useCallback((node, options = {}) => {
    if (!node) {
      return;
    }

    const currentTop = node.getBoundingClientRect().top;
    const offset = options.offset ?? getStickyOffset();
    const destination = Math.max(0, window.scrollY + currentTop - offset);
    const alreadyVisible = currentTop >= offset - 16 && currentTop <= window.innerHeight * 0.4;

    if (options.skipIfVisible && alreadyVisible) {
      return;
    }

    window.scrollTo({ top: destination, behavior: options.behavior || "smooth" });
  }, [getStickyOffset]);

  const scrollToSection = useCallback((id, options = {}) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToNode(document.getElementById(id), options);
      });
    });
  }, [scrollToNode]);

  const scrollToPickResults = useCallback((options = {}) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollToNode(pickResultSectionRef.current, options);
      });
    });
  }, [scrollToNode]);

  const handleRefinePick = useCallback(() => {
    const hasSavedOnboardingSelections = Boolean(
      onboardingVibeId
        || onboardingLikedIds.length
        || onboardingDislikedIds.length
        || onboardingSkippedIds.length
        || onboardingResultActive
    );

    writeSessionFlag(ONBOARDING_DISMISSED_SESSION_KEY, false);
    setOnboardingDismissed(false);
    setIsFirstPickIntroActive(false);
    setOnboardingResultActive(false);
    setPickError(null);
    setPickValidation("");
    setIsPickComposerOpen(false);
    setIsVibeEditorOpen(true);
    if (!hasSavedOnboardingSelections) {
      setOnboardingLikedIds([]);
      setOnboardingDislikedIds([]);
      setOnboardingSkippedIds([]);
    }
    setOnboardingStep(onboardingVibeId ? "taste" : "intent");
    scrollToSection("pick-for-me", { skipIfVisible: true });
  }, [
    onboardingDislikedIds.length,
    onboardingLikedIds.length,
    onboardingResultActive,
    onboardingSkippedIds.length,
    onboardingVibeId,
    scrollToSection,
  ]);

  const focusPickPromptComposer = useCallback(() => {
    window.setTimeout(() => {
      document.getElementById("pick-prompt-input")?.focus();
    }, 140);
  }, []);

  const handleRefinePickForHero = useCallback(() => {
    handleRefinePick();
  }, [handleRefinePick]);

  const clearRestoreTimer = useCallback(() => {
    if (restoreStatusTimeoutRef.current) {
      window.clearTimeout(restoreStatusTimeoutRef.current);
      restoreStatusTimeoutRef.current = null;
    }
  }, []);

  const cancelRestoreState = useCallback((nextStatus = PICK_STATUS.IDLE) => {
    clearRestoreTimer();
    setPickStatus((currentStatus) => {
      if (currentStatus === PICK_STATUS.RESTORING) {
        pickRequestVersionRef.current += 1;
        return nextStatus;
      }

      return currentStatus;
    });
  }, [clearRestoreTimer]);

  const replaceHomePickSession = useCallback((session) => {
    tasteProfileService.saveHomePickSession(session);
  }, []);

  const restoreHomePickSession = () => {
    const storedSession = tasteProfileService.loadHomePickSession();
    if (!storedSession) {
      setPickResult(null);
      setOnboardingResultActive(false);
      setSwapHistory([]);
      setSwapQueue([]);
      setCandidatePoolIds([]);
      setRefinementState(null);
      setPickStatus(PICK_STATUS.IDLE);
      return false;
    }

    setPickPrompt(String(storedSession.originalPrompt || ""));
    setOriginalPickPrompt(String(storedSession.originalPrompt || ""));
    setPickResult(storedSession.currentPick || null);
    setSwapHistory(Array.isArray(storedSession.swapHistory) ? storedSession.swapHistory : []);
    setSwapQueue(Array.isArray(storedSession.swapQueue) ? storedSession.swapQueue : []);
    setLastPickMode(storedSession.lastPickMode === "surprise" ? "surprise" : "prompt");
    setSwapCount(Number(storedSession.swapCount || 0));
    setCandidatePoolIds(Array.isArray(storedSession.candidatePool) ? storedSession.candidatePool : []);
    setRefinementState(storedSession.refinementState || null);
    setHasExpandedSwapPool(Boolean(storedSession.hasExpandedSwapPool));
    setPickError(null);
    setPickValidation("");
    setPickLoadingMessageOverride("");
    setOnboardingResultActive(Boolean(storedSession.currentPick?.primary));
    setOnboardingVibeId(String(storedSession.onboardingVibeId || ""));
    setOnboardingLikedIds(Array.isArray(storedSession.onboardingLikedIds) ? storedSession.onboardingLikedIds : []);
    setOnboardingDislikedIds(Array.isArray(storedSession.onboardingDislikedIds) ? storedSession.onboardingDislikedIds : []);
    setOnboardingSkippedIds(Array.isArray(storedSession.onboardingSkippedIds) ? storedSession.onboardingSkippedIds : []);
    setIsVibeEditorOpen(false);
    setIsPickComposerOpen(false);
    setOnboardingStep(storedSession.currentPick?.primary ? "complete" : "intent");
    restoreVersionRef.current = pickRequestVersionRef.current;
    setPickStatus(storedSession.currentPick?.primary ? PICK_STATUS.RESTORING : PICK_STATUS.IDLE);
    return Boolean(storedSession.currentPick?.primary);
  };


  useEffect(() => {
    setMovieType(routeView);
    setCurrentPage(1);
  }, [routeView]);

  useEffect(() => {
    if (isFeedRoute) {
      return undefined;
    }

    let cancelled = false;

    Promise.allSettled(ONBOARDING_TASTE_FEED_VIEWS.map((view) => homeFeedService.prefetchHomeFeed(view, 1)))
      .then((results) => {
        if (cancelled) {
          return;
        }

        const nextMovies = results.flatMap((result, index) => {
          if (result.status !== "fulfilled") {
            return [];
          }

          return normalizeFeedMovies(result.value?.results || [], ONBOARDING_TASTE_FEED_VIEWS[index]);
        });

        setOnboardingFeedMovies(nextMovies);
      })
      .catch((prefetchError) => {
        console.error("Failed to warm onboarding poster pool:", prefetchError);
      });

    return () => {
      cancelled = true;
    };
  }, [isFeedRoute]);

  useEffect(() => {
    if (isFeedRoute) {
      const timeoutId = window.setTimeout(() => {
        document.getElementById("movie-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [isFeedRoute, location.pathname]);

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const targetId = location.hash.replace("#", "");
    if (!targetId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (targetId === "pick-result" || targetId === "your-pick") {
        scrollToPickResults();
        return;
      }

      scrollToSection(targetId);
    }, 90);

    return () => window.clearTimeout(timeoutId);
  }, [location.hash, loading, movieType, scrollToPickResults, scrollToSection]);

  useEffect(() => {
    if (!location.state?.restorePickSession && !location.state?.scrollToPickResult && !location.state?.focusPickPrompt) {
      return;
    }

    const restored = restoreHomePickSession();
    const timeoutId = window.setTimeout(() => {
      if (location.state?.focusPickPrompt) {
        handleRefinePick();
        return;
      }

      if (restored || location.state?.scrollToPickResult) {
        scrollToPickResults();
      }
    }, 140);

    navigate(`${location.pathname}${location.hash || ""}`, { replace: true, state: {} });
    return () => window.clearTimeout(timeoutId);
  }, [handleRefinePick, location.hash, location.pathname, location.state, navigate, scrollToPickResults]);

  useEffect(
    () => () => {
      clearRestoreTimer();
    },
    [clearRestoreTimer]
  );

  useEffect(() => {
    if (pickStatus !== PICK_STATUS.RESTORING) {
      clearRestoreTimer();
      return undefined;
    }

    const restoreVersion = restoreVersionRef.current;
    restoreStatusTimeoutRef.current = window.setTimeout(() => {
      if (restoreVersion !== pickRequestVersionRef.current) {
        restoreStatusTimeoutRef.current = null;
        return;
      }

      setPickStatus((currentStatus) =>
        currentStatus === PICK_STATUS.RESTORING
          ? (pickResult?.primary ? PICK_STATUS.READY : PICK_STATUS.IDLE)
          : currentStatus
      );
      restoreStatusTimeoutRef.current = null;
    }, RESTORE_STATUS_TIMEOUT_MS);

    return clearRestoreTimer;
  }, [clearRestoreTimer, pickResult, pickStatus]);

  useEffect(() => {
    let cancelled = false;
    const cachedSnapshot = homeFeedService.getCachedFeedSnapshot(movieType, currentPage);
    const cachedMovies = normalizeFeedMovies(cachedSnapshot?.payload?.results || [], movieType);
    const hasCachedMovies = cachedMovies.length > 0;

    if (hasCachedMovies) {
      setMovies(cachedMovies);
      setTotalPages(Number(cachedSnapshot?.payload?.total_pages || 1));
      setLoading(false);
      setIsFeedRefreshing(true);
      setError(null);
    } else {
      setLoading(true);
      setIsFeedRefreshing(false);
      setError(null);
    }

    homeFeedService.requestFeed(movieType, currentPage)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setMovies(normalizeFeedMovies(payload.results || [], movieType));
        setTotalPages(Number(payload.total_pages || 1));
        setError(null);
      })
      .catch((requestError) => {
        if (cancelled) {
          return;
        }

        console.error(`Error fetching ${movieType} movies:`, requestError);
        if (!hasCachedMovies) {
          setError(`Failed to fetch ${movieType} movies.`);
        }
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setLoading(false);
        setIsFeedRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentPage, movieType]);

  useEffect(() => {
    if (!showCapabilities) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowCapabilities(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showCapabilities]);

  useEffect(() => {
    setPickError(null);
    setPickValidation("");
  }, [pickPrompt]);

  useEffect(() => {
    setPickError(null);
    setPickValidation("");
    setPickLoadingMessageOverride("");
    setActivePromptSuggestion("");
  }, [movieType]);

  useEffect(() => {
    if (!isPickBusy) {
      setLoadingMessageIndex(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setLoadingMessageIndex((currentIndex) => (currentIndex + 1) % PICK_LOADING_MESSAGES.length);
    }, 1400);

    return () => window.clearInterval(intervalId);
  }, [isPickBusy]);

  useEffect(() => {
    if (pickPrompt.trim() || activePromptSuggestion || isPickBusy) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setVisiblePromptSuggestions((currentSuggestions) => pickPromptSuggestions(HOMEPAGE_PROMPT_POOL, HOMEPAGE_PROMPT_COUNT, currentSuggestions));
    }, PROMPT_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [activePromptSuggestion, isPickBusy, pickPrompt]);

  useEffect(() => {
    setIsPickTrailerOpen(false);
  }, [pickResult?.primary?.id]);

  useEffect(() => {
    if (!pickResult?.primary) {
      return;
    }

    replaceHomePickSession({
      originalPrompt: originalPickPrompt,
      currentPick: pickResult,
      swapHistory,
      swapQueue,
      lastPickMode,
      swapCount,
      candidatePool: candidatePoolIds,
      refinementState,
      hasExpandedSwapPool,
      onboardingVibeId,
      onboardingLikedIds,
      onboardingDislikedIds,
      onboardingSkippedIds,
    });
  }, [
    candidatePoolIds,
    hasExpandedSwapPool,
    lastPickMode,
    onboardingDislikedIds,
    onboardingLikedIds,
    onboardingSkippedIds,
    onboardingVibeId,
    originalPickPrompt,
    pickResult,
    refinementState,
    replaceHomePickSession,
    swapCount,
    swapHistory,
    swapQueue,
  ]);

  const handleViewChange = (view) => {
    setCurrentPage(1);
    navigate(getFeedPath(view));
  };

  const handleExploreMoodChange = (moodId) => {
    setSelectedMood(moodId);
    scrollToSection("movie-grid");
  };

  const selectedMoodConfig = useMemo(
    () => MOOD_FILTERS.find((filter) => filter.id === selectedMood) || MOOD_FILTERS[0],
    [selectedMood]
  );

  const suppressedMovieIds = useMemo(
    () => new Set((profile.skipped || []).map((item) => item.id).filter(Boolean)),
    [profile.skipped]
  );
  const seenMovieIds = useMemo(
    () => new Set((profile.seen || []).map((item) => item.id).filter(Boolean)),
    [profile.seen]
  );
  const visibleMovies = useMemo(() => movies.filter((movie) => !suppressedMovieIds.has(movie.id)), [movies, suppressedMovieIds]);
  const curatedMovies = useMemo(() => {
    const qualityFiltered = visibleMovies.filter((movie) => passesFeedQualityCheck(movie, movieType));
    const fallbackPool = qualityFiltered.length >= Math.min(MIN_CURATED_FEED_SIZE, visibleMovies.length) ? qualityFiltered : visibleMovies;

    return [...fallbackPool].sort((leftMovie, rightMovie) => {
      const leftBaseScore = getFeedCurationScore(leftMovie, movieType);
      const rightBaseScore = getFeedCurationScore(rightMovie, movieType);

      if (!hasBehavioralSignals(behavioralMemory)) {
        return rightBaseScore - leftBaseScore;
      }

      const leftMemoryScore = scoreMovieForBehavioralMemory(leftMovie, behavioralMemory, { surface: "home" }).score;
      const rightMemoryScore = scoreMovieForBehavioralMemory(rightMovie, behavioralMemory, { surface: "home" }).score;

      return (rightBaseScore + rightMemoryScore) - (leftBaseScore + leftMemoryScore);
    });
  }, [behavioralMemory, movieType, visibleMovies]);

  const filteredMovies = useMemo(
    () => curatedMovies.filter((movie) => selectedMoodConfig.predicate(movie)),
    [curatedMovies, selectedMoodConfig]
  );

  const displayedMovies = useMemo(() => {
    if (!filteredMovies.length) {
      return [];
    }

    const trimmedMovies = trimMoviesToDisplayCount(filteredMovies, movieType);

    if (trimmedMovies.length) {
      return trimmedMovies;
    }

    return trimMoviesToDisplayCount(curatedMovies, movieType);
  }, [curatedMovies, filteredMovies, movieType]);

  const heroPreviewMovies = useMemo(() => {
    const source = displayedMovies.length ? displayedMovies : filteredMovies.length ? filteredMovies : curatedMovies;
    return source.slice(0, isCompactHeroPreview ? 4 : 3);
  }, [curatedMovies, displayedMovies, filteredMovies, isCompactHeroPreview]);
  const onboardingVibe = useMemo(
    () => ONBOARDING_VIBES.find((option) => option.id === onboardingVibeId) || null,
    [onboardingVibeId]
  );
  const onboardingPosterPool = useMemo(
    () => [...displayedMovies, ...curatedMovies, ...onboardingFeedMovies],
    [curatedMovies, displayedMovies, onboardingFeedMovies]
  );
  const onboardingPosterDeck = useMemo(
    () => buildOnboardingPosterDeck(onboardingPosterPool, onboardingVibeId || "surprise_me", movieType),
    [movieType, onboardingPosterPool, onboardingVibeId]
  );
  const onboardingInteractionCount = onboardingLikedIds.length + onboardingDislikedIds.length + onboardingSkippedIds.length;
  const canFinishOnboarding = onboardingInteractionCount >= ONBOARDING_MIN_SIGNAL_COUNT;
  const onboardingRemainingCount = Math.max(0, ONBOARDING_MIN_SIGNAL_COUNT - onboardingInteractionCount);
  const onboardingLikedMovies = useMemo(
    () => onboardingPosterDeck.filter((movie) => onboardingLikedIds.includes(movie.id)),
    [onboardingLikedIds, onboardingPosterDeck]
  );
  const onboardingDislikedMovies = useMemo(
    () => onboardingPosterDeck.filter((movie) => onboardingDislikedIds.includes(movie.id)),
    [onboardingDislikedIds, onboardingPosterDeck]
  );
  const onboardingSignalSummary = useMemo(() => {
    const likedSummary = onboardingLikedMovies.length ? `${onboardingLikedMovies.length} liked` : "No strong likes yet";
    const dislikedSummary = onboardingDislikedMovies.length ? `${onboardingDislikedMovies.length} not for me` : "";
    return [likedSummary, dislikedSummary].filter(Boolean).join(" • ");
  }, [onboardingDislikedMovies.length, onboardingLikedMovies.length]);
  const homepageUserState = user
    ? HOMEPAGE_USER_STATE.AUTHENTICATED
    : hasInitialLocalSession
      ? HOMEPAGE_USER_STATE.SESSION
      : HOMEPAGE_USER_STATE.NEW;
  const isNewHomepageUser = homepageUserState === HOMEPAGE_USER_STATE.NEW;
  const isSessionHomepageUser = homepageUserState === HOMEPAGE_USER_STATE.SESSION;
  const isAuthenticatedHomepageUser = homepageUserState === HOMEPAGE_USER_STATE.AUTHENTICATED;

  const viewLabel = getViewLabel(movieType);
  const heading = FEED_METADATA[movieType]?.heading || getViewLabel(movieType);

  const sectionSubtitle = useMemo(() => {
    if (selectedMood !== "all") {
      return `${selectedMoodConfig.label} picks from this ${viewLabel.toLowerCase()} lineup.`;
    }

    if (movieType === "popular") {
      return "A look at what is trending this week.";
    }

    if (movieType === "upcoming") {
      return "A look at what's arriving soon.";
    }

    return "What’s currently in theaters.";
  }, [movieType, selectedMood, selectedMoodConfig.label, viewLabel]);

  const hasVisibleFeedContent = displayedMovies.length > 0;
  const shouldShowFeedSkeletons = loading && !curatedMovies.length;
  const feedCountLabel = selectedMood === "all" ? `${displayedMovies.length} curated titles` : `${displayedMovies.length} curated matches`;
  const feedCountDisplayLabel = shouldShowFeedSkeletons
    ? "Loading lineup"
    : isFeedRefreshing && hasVisibleFeedContent
      ? `${feedCountLabel} • Updating`
      : feedCountLabel;
  const heroPreviewLabel = movieType === "upcoming" ? "Coming soon" : movieType === "popular" ? "Trending this week" : "Now playing";
  const browseLibraryPath = `/browse${selectedMood !== "all" ? `?mood=${selectedMood}` : ""}`;
  const browseLibraryResultsPath = `${browseLibraryPath}${browseLibraryPath.includes("?") ? "&" : "?"}view=${movieType}#library-results`;
  const activePick = pickResult?.primary || null;
  const backupPicks = useMemo(() => pickResult?.alternates || [], [pickResult]);
  const recommendationRationale = useMemo(
    () => buildRecommendationRationale({ pickResult, activePick, profile, surpriseMode: lastPickMode === "surprise" }),
    [pickResult, activePick, profile, lastPickMode]
  );
  const onboardingReasoning = useMemo(() => (
    onboardingResultActive && activePick
      ? buildOnboardingReasoningCopy({
          vibe: onboardingVibe,
          likedMovies: onboardingLikedMovies,
          dislikedMovies: onboardingDislikedMovies,
          activePick,
        })
      : ""
  ), [activePick, onboardingDislikedMovies, onboardingLikedMovies, onboardingResultActive, onboardingVibe]);
  const shouldShowFirstPickIntro = isNewHomepageUser && onboardingResultActive && Boolean(activePick) && isFirstPickIntroActive && !hasSeenFirstPickSummary;
  const resultRationale = useMemo(() => {
    if (!recommendationRationale) {
      return recommendationRationale;
    }

    return onboardingReasoning
      ? {
          ...recommendationRationale,
          decisionSentence: onboardingReasoning || recommendationRationale.decisionSentence,
        }
      : recommendationRationale;
  }, [onboardingReasoning, recommendationRationale]);
  const lastPickMeta = useMemo(() => {
    const title = activePick?.title || "";
    const reason =
      resultRationale?.primary_reason ||
      resultRationale?.decisionSentence ||
      activePick?.reason ||
      "";

    return {
      lastPickTitle: title.trim(),
      lastPickReason: reason.trim(),
    };
  }, [activePick, resultRationale]);
  const backupPicksWithRoles = useMemo(
    () => backupPicks.map((movie, index) => ({ ...movie, backupRole: movie.backupRole || getBackupRoleLabel(movie, index) })),
    [backupPicks]
  );
  const queuedSwapIds = useMemo(() => swapQueue.map((movie) => movie?.id).filter(Boolean), [swapQueue]);
  const swapHistoryExcludedIds = useMemo(
    () => Array.from(new Set(swapHistory.flatMap((entry) => getPickSessionMovieIds(entry)))),
    [swapHistory]
  );
  const persistentExcludedIds = useMemo(
    () =>
      Array.from(
        new Set((profile.skipped || []).map((item) => item.id).filter(Boolean))
      ),
    [profile.skipped]
  );
  const hasActivePickSession = Boolean(activePick || swapHistory.length);
  const shouldShowEmptyPickState = pickStatus === PICK_STATUS.IDLE && !activePick && !hasActivePickSession;
  const shouldShowPickSessionPlaceholder = pickStatus === PICK_STATUS.RESTORING;
  const shouldShowPickFallbackState = !activePick && (pickStatus === PICK_STATUS.EXHAUSTED || pickStatus === PICK_STATUS.ERROR);
  const pickResultTitle = "Your pick";
  const pickResultSubtitle = isSessionHomepageUser && activePick
      ? "Your recent ReelBot pick is still here, with a few nearby options."
      : isAuthenticatedHomepageUser && activePick
        ? "A current pick, with a few nearby options."
        : activePick
          ? "A strong pick, with a few nearby alternatives."
          : "";
  const pickFallbackTitle = pickStatus === PICK_STATUS.ERROR ? "Couldn’t get a pick" : "No strong pick yet";
  const pickFallbackCopy = pickError || PICK_REQUEST_FALLBACK_MESSAGE;
  const candidatePoolSize = Array.isArray(pickResult?.candidate_pool_ids)
    ? pickResult.candidate_pool_ids.length
    : candidatePoolIds.length;
  const candidatePoolExhausted = pickStatus === PICK_STATUS.EXHAUSTED;
  const refreshExhausted =
    candidatePoolSize > 0 && candidatePoolSize < PICK_REFRESH_EXHAUSTION_THRESHOLD;
  const refreshExhaustionMessage = candidatePoolExhausted
    ? "ReelBot’s lane is exhausted—start fresh or refine your vibe."
    : refreshExhausted
      ? "You've seen the strongest options here"
      : "";
  const pickRecoveryTitle =
    pickStatus === PICK_STATUS.LOADING_SWAP
      ? "Swapping your pick…"
      : pickStatus === PICK_STATUS.ERROR
        ? "Keeping your last strong pick"
        : pickStatus === PICK_STATUS.EXHAUSTED && activePick
          ? "Want more options?"
          : "";
  const pickRecoveryMessage = activePick
    ? (pickStatus === PICK_STATUS.LOADING_SWAP
        ? (pickLoadingMessageOverride || SWAP_LOADING_MESSAGE)
        : pickStatus === PICK_STATUS.LOADING
          ? (pickLoadingMessageOverride || PICK_LOADING_MESSAGES[loadingMessageIndex] || "Evaluating candidates…")
        : pickStatus === PICK_STATUS.ERROR
          ? (pickError || SWAP_REQUEST_ERROR_MESSAGE)
          : pickStatus === PICK_STATUS.EXHAUSTED
            ? SOFT_SWAP_MESSAGE
            : "")
    : "";
  const inlineRefineStatus = activePick && isPickBusy ? (pickLoadingMessageOverride || (isSwapLoading ? SWAP_LOADING_MESSAGE : PICK_LOADING_MESSAGES[loadingMessageIndex] || "Evaluating candidates…")) : "";
  const showOnboardingFlow = isVibeEditorOpen || (isNewHomepageUser && !onboardingDismissed && (!hasCompletedOnboarding || onboardingStep !== "intent"));
  const showPromptComposerSection = !showOnboardingFlow && (!activePick || isPickComposerOpen);
  const shouldRenderPickResultSection = Boolean(activePick || isPickBusy || shouldShowPickFallbackState || shouldShowPickSessionPlaceholder);
  const showSessionResumeMessaging = isSessionHomepageUser && (activePick || hasActivePickSession || shouldShowPickSessionPlaceholder);
  const heroHeadline = showSessionResumeMessaging
    ? "Pick up where you left off"
    : isAuthenticatedHomepageUser
      ? "Find something worth watching"
      : homeHeadline;
  const heroSubtext = showSessionResumeMessaging
    ? "Your recent picks are saved on this device."
    : isAuthenticatedHomepageUser
      ? "ReelBot uses your saved signals to keep the next pick sharper."
      : "Start with a vibe. We’ll do the rest.";
  const heroSupportCopy = showSessionResumeMessaging
    ? "Your last ReelBot session is still here."
    : isAuthenticatedHomepageUser
      ? "Your history is already in play."
      : "Learns fast. Keeps getting sharper.";
  const primaryHeroActionLabel = activePick ? "See your pick" : "Get a pick";

  const homeStructuredData = useMemo(() => {
    if (isFeedRoute) {
      return [
        buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: heading, path: FEED_METADATA[movieType]?.path || "/now-playing" },
        ]),
        displayedMovies.length
          ? buildItemListJsonLd(
              displayedMovies.slice(0, 12).map((movie) => ({
                name: movie.title,
                path: getMoviePath(movie),
              }))
            )
          : null,
      ].filter(Boolean);
    }

    return [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: buildAbsoluteUrl("/"),
        logo: buildAbsoluteUrl("/logo512.png"),
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: buildAbsoluteUrl("/"),
        potentialAction: {
          "@type": "SearchAction",
          target: `${buildAbsoluteUrl("/search")}?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: SITE_NAME,
        url: buildAbsoluteUrl("/"),
        applicationCategory: "EntertainmentApplication",
        operatingSystem: "Web",
        description: "AI movie recommendation companion for quick picks, spoiler-light takes, review splits, and better next-watch decisions.",
      },
      buildBreadcrumbJsonLd([{ name: "Home", path: "/" }]),
    ];
  }, [displayedMovies, heading, isFeedRoute, movieType]);

  usePageMetadata(
    isFeedRoute
      ? {
          title: FEED_METADATA[movieType]?.title || "Now Playing Movies | ReelBot",
          description: FEED_METADATA[movieType]?.description || SITE_DESCRIPTION,
          path: FEED_METADATA[movieType]?.path || "/now-playing",
          structuredData: homeStructuredData,
        }
      : {
          title: "ReelBot — AI Movie Picker | Find Something Worth Watching",
          description:
            "Find something worth watching with ReelBot — fast recommendations, spoiler-light insights, and sharper next-watch picks.",
          path: "/",
          image: DEFAULT_SOCIAL_IMAGE,
          structuredData: homeStructuredData,
        }
  );

  const pickVibeLabel = useMemo(() => {
    if (shouldShowFirstPickIntro && onboardingVibe?.shortLabel) {
      return onboardingVibe.shortLabel;
    }

    return originalPickPrompt.trim() || pickPrompt.trim();
  }, [onboardingVibe?.shortLabel, originalPickPrompt, pickPrompt, shouldShowFirstPickIntro]);

  const markFirstPickSummarySeen = useCallback(() => {
    if (!isFirstPickIntroActive && hasSeenFirstPickSummary) {
      return;
    }

    writeLocalFlag(FIRST_PICK_SUMMARY_SEEN_STORAGE_KEY, true);
    setHasSeenFirstPickSummary(true);
    setIsFirstPickIntroActive(false);
  }, [hasSeenFirstPickSummary, isFirstPickIntroActive]);

  const runPickRequest = async (nextPreferences, options = {}, retryCount = 0, retryExcludedIds = []) => {
    const baseExcludedIds = options.customExcludedIds || getPickExcludedIds(nextPreferences, options.extraExcludedIds || []);
    const excludedIds = dedupeIds([...(Array.isArray(baseExcludedIds) ? baseExcludedIds : []), ...retryExcludedIds]);
    const requestPayload = {
      ...nextPreferences,
      excluded_ids: excludedIds,
      behavioral_memory: behavioralMemory,
      trigger: "user_click",
      is_swap: Boolean(options.isSwap),
    };

    if (options.intentSnapshot || ((options.isSwap || options.isRefinement) && pickResult?.resolved_intent)) {
      requestPayload.intent_snapshot = options.intentSnapshot || pickResult?.resolved_intent;
    }

    if (!options.disableCandidatePoolReuse && (options.candidatePoolIds || ((options.isSwap || options.isRefinement) && candidatePoolIds.length))) {
      requestPayload.candidate_pool_ids = options.candidatePoolIds || candidatePoolIds;
    }

    if (options.refreshKey) {
      requestPayload.refresh_key = options.refreshKey;
    }

    if (options.refinement) {
      requestPayload.refinement = options.refinement;
    }

    const response = await axios.post(`${API_BASE_URL}/reelbot/pick`, requestPayload, {
      headers: {
        "X-ReelBot-Trigger": "user_click",
      },
    });

    const normalizedPayload = normalizePickPayload(response.data, requestPayload.excluded_ids);
    if (normalizedPayload) {
      return normalizedPayload;
    }

    if (retryCount >= 1) {
      const noValidPickError = new Error("No valid ReelBot pick returned.");
      noValidPickError.code = PICK_STATUS.EXHAUSTED;
      throw noValidPickError;
    }

    const returnedIds = dedupeIds([response.data?.primary?.id, ...((response.data?.alternates || []).map((movie) => movie?.id))]);
    return runPickRequest(
      nextPreferences,
      {
        ...options,
        disableCandidatePoolReuse: true,
        refreshKey: `fallback-${Date.now()}-${retryCount + 1}`,
      },
      retryCount + 1,
      [...retryExcludedIds, ...returnedIds]
    );
  };

  const requestPick = async (nextPreferences, options = {}) => {
    const previousPick = pickResult;
    const requestVersion = pickRequestVersionRef.current + 1;
    pickRequestVersionRef.current = requestVersion;

    try {
      setPickStatus(options.isSwap ? PICK_STATUS.LOADING_SWAP : PICK_STATUS.LOADING);
      setPickLoadingMessageOverride(options.loadingMessage || "");
      setPickError(null);
      setPickValidation("");
      void tasteActions.savePickPreferences({ ...nextPreferences, log_prompt_submission: !options.isSwap }).catch(() => {});

      if (options.scrollToResults) {
        scrollToPickResults();
      }

      const nextPayload = await runPickRequest(nextPreferences, options);
      if (requestVersion !== pickRequestVersionRef.current) {
        return null;
      }

      setPickResult(nextPayload);
      setSwapQueue(buildSwapQueueFromPayload(nextPayload));
      setCandidatePoolIds(Array.isArray(nextPayload.candidate_pool_ids) ? nextPayload.candidate_pool_ids : []);
      setRefinementState(nextPayload.resolved_refinement || options.refinement || null);
      setPickStatus(PICK_STATUS.READY);
      setIsPickComposerOpen(false);
      if (options.isSwap && previousPick?.primary) {
        setSwapHistory((currentHistory) => [...currentHistory, previousPick].slice(-10));
      } else {
        setSwapHistory([]);
      }
      void tasteActions.recordPickResult(nextPreferences, nextPayload).catch(() => {});

      if (options.scrollToResults) {
        scrollToPickResults({ skipIfVisible: true });
      }

      return nextPayload;
    } catch (requestError) {
      if (requestVersion !== pickRequestVersionRef.current) {
        return null;
      }

      console.error("Error fetching ReelBot pick:", requestError);
      const nextStatus = requestError?.code === PICK_STATUS.EXHAUSTED ? PICK_STATUS.EXHAUSTED : PICK_STATUS.ERROR;

      if (options.isSwap && previousPick?.primary) {
        setPickResult(previousPick);
        setPickStatus(nextStatus);
        setPickError(nextStatus === PICK_STATUS.EXHAUSTED ? SOFT_SWAP_MESSAGE : SWAP_REQUEST_ERROR_MESSAGE);
      } else {
        setPickResult(previousPick || null);
        setPickStatus(previousPick?.primary ? PICK_STATUS.ERROR : nextStatus);
        setPickError(nextStatus === PICK_STATUS.EXHAUSTED ? PICK_REQUEST_FALLBACK_MESSAGE : PICK_REQUEST_ERROR_MESSAGE);
      }

      return null;
    } finally {
      if (requestVersion === pickRequestVersionRef.current) {
        setPickLoadingMessageOverride("");
      }
    }
  };

  const refillSwapQueueInBackground = async (nextPreferences, options = {}) => {
    const requestVersion = pickRequestVersionRef.current;

    try {
      const refillPayload = await runPickRequest(nextPreferences, options);
      if (requestVersion !== pickRequestVersionRef.current) {
        return;
      }

      setCandidatePoolIds((currentIds) => {
        const incomingIds = Array.isArray(refillPayload?.candidate_pool_ids) ? refillPayload.candidate_pool_ids : [];
        return incomingIds.length ? incomingIds : currentIds;
      });
      setRefinementState((currentRefinement) => refillPayload?.resolved_refinement || currentRefinement || null);
      setSwapQueue((currentQueue) => {
        const excludedIds = dedupeIds([
          pickResult?.primary?.id,
          ...swapHistoryExcludedIds,
          ...currentQueue.map((movie) => movie?.id),
          ...(options.extraExcludedIds || []),
        ]);
        const incomingQueue = [refillPayload?.primary, ...((Array.isArray(refillPayload?.alternates) ? refillPayload.alternates : []))];
        const mergedQueue = mergeSwapQueue(currentQueue, incomingQueue, excludedIds);
        setPickResult((currentPickResult) => {
          if (!currentPickResult?.primary) {
            return currentPickResult;
          }

          return {
            ...currentPickResult,
            alternates: mergedQueue.slice(0, 3),
            candidate_pool_ids: Array.isArray(refillPayload?.candidate_pool_ids) && refillPayload.candidate_pool_ids.length
              ? refillPayload.candidate_pool_ids
              : currentPickResult.candidate_pool_ids,
          };
        });
        return mergedQueue;
      });
    } catch (refillError) {
      if (requestVersion !== pickRequestVersionRef.current) {
        return;
      }

      console.error("Error refilling ReelBot swap queue:", refillError);
    } finally {
      if (requestVersion === pickRequestVersionRef.current) {
        setPickStatus((currentStatus) => (currentStatus === PICK_STATUS.LOADING_SWAP ? PICK_STATUS.READY : currentStatus));
        setPickLoadingMessageOverride("");
      }
    }
  };

  const submitPick = async (
    overrides = {},
    options = {},
    variationFocus = null,
    lastPickMeta = { lastPickTitle: "", lastPickReason: "" }
  ) => {
    const normalizedLastPickTitle = String(lastPickMeta?.lastPickTitle || "").trim();
    const normalizedLastPickReason = String(lastPickMeta?.lastPickReason || "").trim();

    const nextPreferences = {
      view: movieType,
      mood: "all",
      runtime: "any",
      source: "feed",
      company: "any",
      prompt: pickPrompt,
      ...overrides,
    };

    if (normalizedLastPickTitle) {
      nextPreferences.last_pick_title = normalizedLastPickTitle;
    }

    if (normalizedLastPickReason) {
      nextPreferences.last_pick_reason = normalizedLastPickReason;
    }

    if (variationFocus) {
      nextPreferences.variation_focus = variationFocus;
    }

    if (Object.prototype.hasOwnProperty.call(overrides, "prompt")) {
      setPickPrompt(nextPreferences.prompt);
    }

    if (!options.isSwap) {
      const nextPrompt = String(nextPreferences.prompt || "").trim();

      clearRestoreTimer();
      setOriginalPickPrompt(nextPrompt);
      setSwapHistory([]);
      setSwapQueue([]);
      setSwapCount(0);
      setCandidatePoolIds([]);
      setRefinementState(null);
      setHasExpandedSwapPool(false);
      setPickError(null);
      replaceHomePickSession({
        originalPrompt: nextPrompt,
        currentPick: pickResult,
        swapHistory: [],
        swapQueue: [],
        lastPickMode: nextPreferences.source === "library" ? "surprise" : "prompt",
        swapCount: 0,
        candidatePool: [],
        refinementState: null,
        hasExpandedSwapPool: false,
      });
    }

    await requestPick(nextPreferences, options);
  };

  const resetOnboardingSignals = useCallback(() => {
    setOnboardingLikedIds([]);
    setOnboardingDislikedIds([]);
    setOnboardingSkippedIds([]);
  }, []);

  const clearOnboardingCompletion = useCallback(() => {
    writeLocalFlag(ONBOARDING_COMPLETED_STORAGE_KEY, false);
    setHasCompletedOnboarding(false);
  }, []);

  const clearOnboardingDismissal = useCallback(() => {
    writeSessionFlag(ONBOARDING_DISMISSED_SESSION_KEY, false);
    setOnboardingDismissed(false);
  }, []);

  const handleStartFresh = useCallback(() => {
    pickRequestVersionRef.current += 1;
    clearRestoreTimer();
    setPickPrompt("");
    setOriginalPickPrompt("");
    setActivePromptSuggestion("");
    setPickError(null);
    setPickValidation("");
    setPickResult(null);
    setSwapHistory([]);
    setSwapQueue([]);
    setLastPickMode("prompt");
    setSwapCount(0);
    setVariationIndex(0);
    setCandidatePoolIds([]);
    setRefinementState(null);
    setHasExpandedSwapPool(false);
    setPickStatus(PICK_STATUS.IDLE);
    setPickLoadingMessageOverride("");
    setOnboardingVibeId("");
    resetOnboardingSignals();
    setOnboardingResultActive(false);
    setIsVibeEditorOpen(false);
    setOnboardingStep("intent");
    setIsFirstPickIntroActive(false);
    setIsPickTrailerOpen(false);
    setIsPickComposerOpen(false);

    if (isNewHomepageUser) {
      clearOnboardingDismissal();
      clearOnboardingCompletion();
    }

    scrollToSection("pick-for-me", { skipIfVisible: true });

    if (!isNewHomepageUser) {
      focusPickPromptComposer();
    }
  }, [clearOnboardingCompletion, clearOnboardingDismissal, clearRestoreTimer, focusPickPromptComposer, isNewHomepageUser, resetOnboardingSignals, scrollToSection]);

  const handleOnboardingVibeSelect = (vibeId) => {
    cancelRestoreState(activePick ? PICK_STATUS.READY : PICK_STATUS.IDLE);
    setOnboardingVibeId(vibeId);
    setOnboardingResultActive(false);
    setIsVibeEditorOpen(true);
    setPickError(null);
    setPickValidation("");
  };

  const handleOnboardingContinue = () => {
    if (!onboardingVibeId) {
      return;
    }

    clearOnboardingDismissal();
    resetOnboardingSignals();
    setIsVibeEditorOpen(true);
    setOnboardingStep("taste");
    scrollToSection("pick-for-me", { skipIfVisible: true });
  };

  const handleOnboardingPick = async (signalOverrides = {}) => {
    const activeVibe = ONBOARDING_VIBES.find((option) => option.id === onboardingVibeId);
    const likedIds = signalOverrides.likedIds || onboardingLikedIds;
    const dislikedIds = signalOverrides.dislikedIds || onboardingDislikedIds;

    if (!activeVibe || onboardingStep === "loading" || likedIds.length + dislikedIds.length + onboardingSkippedIds.length < ONBOARDING_MIN_SIGNAL_COUNT) {
      return null;
    }

    const likedMovies = onboardingPosterDeck.filter((movie) => likedIds.includes(movie.id));
    const dislikedMovies = onboardingPosterDeck.filter((movie) => dislikedIds.includes(movie.id));
    const onboardingPrompt = buildOnboardingPrompt({
      vibe: activeVibe,
      likedMovies,
      dislikedMovies,
    });
    const nextPreferences = {
      view: movieType,
      mood: "all",
      runtime: "any",
      source: "library",
      company: "any",
      prompt: onboardingPrompt,
    };

    cancelRestoreState(activePick ? PICK_STATUS.READY : PICK_STATUS.IDLE);
    clearRestoreTimer();
    setPickPrompt(onboardingPrompt);
    setOriginalPickPrompt(onboardingPrompt);
    setLastPickMode("prompt");
    setSwapHistory([]);
    setSwapQueue([]);
    setSwapCount(0);
    setCandidatePoolIds([]);
    setRefinementState(null);
    setHasExpandedSwapPool(false);
    setPickError(null);
    setPickValidation("");
    setOnboardingStep("loading");
    setIsVibeEditorOpen(true);
    replaceHomePickSession({
      originalPrompt: onboardingPrompt,
      currentPick: null,
      swapHistory: [],
      swapQueue: [],
      lastPickMode: "prompt",
      swapCount: 0,
      candidatePool: [],
      refinementState: null,
      hasExpandedSwapPool: false,
      onboardingVibeId,
      onboardingLikedIds: likedIds,
      onboardingDislikedIds: dislikedIds,
      onboardingSkippedIds,
    });

    const nextPayload = await requestPick(nextPreferences, {
      scrollToResults: true,
      loadingMessage: "Learning your taste and lining up a strong first pick…",
      customExcludedIds: getPickExcludedIds(nextPreferences, dislikedIds),
      refreshKey: `onboarding-${Date.now()}`,
    });

    if (nextPayload?.primary) {
      writeLocalFlag(ONBOARDING_COMPLETED_STORAGE_KEY, true);
      writeSessionFlag(ONBOARDING_DISMISSED_SESSION_KEY, false);
      setHasCompletedOnboarding(true);
      setOnboardingDismissed(false);
      setIsFirstPickIntroActive(!hasSeenFirstPickSummary);
      setOnboardingResultActive(true);
      setIsVibeEditorOpen(false);
      setOnboardingStep("complete");
      return nextPayload;
    }

    setOnboardingResultActive(false);
    setIsVibeEditorOpen(true);
    setOnboardingStep("taste");
    setIsFirstPickIntroActive(false);
    return null;
  };

  const handleOnboardingReaction = (movieId, reaction) => {
    if (!movieId || onboardingStep === "loading") {
      return;
    }

    const withoutMovie = (values = []) => values.filter((value) => value !== movieId);

    if (reaction === "like") {
      setOnboardingLikedIds((currentValues) => dedupeIds([...withoutMovie(currentValues), movieId]));
      setOnboardingDislikedIds((currentValues) => withoutMovie(currentValues));
      setOnboardingSkippedIds((currentValues) => withoutMovie(currentValues));
      return;
    }

    if (reaction === "dislike") {
      setOnboardingLikedIds((currentValues) => withoutMovie(currentValues));
      setOnboardingDislikedIds((currentValues) => dedupeIds([...withoutMovie(currentValues), movieId]));
      setOnboardingSkippedIds((currentValues) => withoutMovie(currentValues));
      return;
    }

    setOnboardingLikedIds((currentValues) => withoutMovie(currentValues));
    setOnboardingDislikedIds((currentValues) => withoutMovie(currentValues));
    setOnboardingSkippedIds((currentValues) => dedupeIds([...withoutMovie(currentValues), movieId]));
  };

  const handleRestartOnboarding = () => {
    handleStartFresh();
  };

  const handleDismissOnboarding = () => {
    writeSessionFlag(ONBOARDING_DISMISSED_SESSION_KEY, true);
    setOnboardingDismissed(true);
    resetOnboardingSignals();
    setOnboardingVibeId("");
    setOnboardingStep("intent");
    setOnboardingResultActive(false);
    setIsVibeEditorOpen(false);
    setIsPickComposerOpen(false);
    setIsFirstPickIntroActive(false);
    setPickError(null);
    setPickValidation("");
    window.requestAnimationFrame(() => {
      scrollToSection("pick-for-me", { skipIfVisible: true });
    });
  };

  const handleRefreshPick = async () => {
    if (isPickBusy || !pickResult?.primary) {
      return;
    }

    const swapPreferences = {
      view: movieType,
      mood: "all",
      runtime: "any",
      source: lastPickMode === "surprise" ? "library" : "feed",
      company: "any",
      prompt: originalPickPrompt || pickPrompt,
    };

    void tasteActions.recordSwapFeedback(
      pickResult.primary,
      swapPreferences,
      { swapCount: swapCount + 1 }
    ).catch(() => {});

    const currentDeckIds = [pickResult?.primary?.id, ...((pickResult?.alternates || []).map((movie) => movie.id)), ...queuedSwapIds].filter(Boolean);
    const nextSwapCount = swapCount + 1;
    const shouldExpandSearch = nextSwapCount > SWAP_SOFT_EXHAUSTION_THRESHOLD;
    const hasStrictThemeLock = Boolean(pickResult?.resolved_intent?.strict_filters?.require_theme_match);
    const shouldReuseCandidatePool = !shouldExpandSearch && !hasStrictThemeLock && candidatePoolIds.length > currentDeckIds.length;

    setSwapCount(nextSwapCount);
    setHasExpandedSwapPool(shouldExpandSearch);

    if (swapQueue.length) {
      const [nextPrimary, ...remainingQueue] = swapQueue;
      const previousPick = pickResult;
      const nextPayload = promoteQueuedPick(previousPick, nextPrimary, remainingQueue);

      setPickResult(nextPayload);
      setSwapQueue(remainingQueue);
      setSwapHistory((currentHistory) => [...currentHistory, previousPick].slice(-10));
      setPickStatus(PICK_STATUS.LOADING_SWAP);
      setPickLoadingMessageOverride(shouldExpandSearch ? EXPANDED_SWAP_LOADING_MESSAGE : SWAP_LOADING_MESSAGE);
      void tasteActions.recordPickResult(swapPreferences, nextPayload).catch(() => {});
      scrollToPickResults({ skipIfVisible: true });

      refillSwapQueueInBackground(
        swapPreferences,
        {
          isSwap: true,
          intentSnapshot: pickResult?.resolved_intent,
          candidatePoolIds: shouldReuseCandidatePool ? candidatePoolIds : [],
          extraExcludedIds: [...currentDeckIds, ...swapHistoryExcludedIds],
          customExcludedIds: shouldExpandSearch ? [...persistentExcludedIds, ...currentDeckIds, ...swapHistoryExcludedIds] : undefined,
          disableCandidatePoolReuse: !shouldReuseCandidatePool,
          loadingMessage: shouldExpandSearch ? EXPANDED_SWAP_LOADING_MESSAGE : "",
          refreshKey: shouldExpandSearch ? `expanded-refill-${Date.now()}` : `swap-refill-${Date.now()}`,
        }
      );
      return;
    }

    const variationFocus = getVariationFocusFromIndex(variationIndex);
    if (variationFocus) {
      setVariationIndex((current) => current + 1);
    }

    await submitPick(
      {},
      {
        isSwap: true,
        scrollToResults: true,
        extraExcludedIds: [...currentDeckIds, ...swapHistoryExcludedIds],
        customExcludedIds: shouldExpandSearch ? [...persistentExcludedIds, ...currentDeckIds, ...swapHistoryExcludedIds] : undefined,
        disableCandidatePoolReuse: !shouldReuseCandidatePool,
        loadingMessage: shouldExpandSearch ? EXPANDED_SWAP_LOADING_MESSAGE : "",
        refreshKey: shouldExpandSearch ? `expanded-${Date.now()}` : Date.now(),
      },
      variationFocus,
      lastPickMeta
    );
  };

  const handleInlineRefinement = async (action) => {
    if (isPickBusy || !pickResult?.primary || !action?.id) {
      return;
    }

    await submitPick(
      {},
      {
        isSwap: true,
        isRefinement: true,
        scrollToResults: true,
        intentSnapshot: pickResult?.resolved_intent,
        candidatePoolIds,
        extraExcludedIds: [pickResult.primary.id],
        loadingMessage: action.loadingMessage || "Refining your pick…",
        refreshKey: `refine-${action.id}-${Date.now()}`,
        refinement: {
          id: action.id,
          label: action.label,
          source_movie_id: pickResult.primary.id,
          source_movie_title: pickResult.primary.title,
        },
      },
      null,
      lastPickMeta
    );
  };

  const handlePickSubmit = async () => {
    cancelRestoreState(activePick ? PICK_STATUS.READY : PICK_STATUS.IDLE);

    if (!pickPrompt.trim()) {
      setPickValidation("Enter a vibe or choose Surprise me.");
      return;
    }

    clearRestoreTimer();
    setOnboardingResultActive(false);
    setLastPickMode("prompt");
    setOriginalPickPrompt(pickPrompt.trim());
    setSwapCount(0);
    setHasExpandedSwapPool(false);
    await submitPick({}, { scrollToResults: true }, null, lastPickMeta);
  };

  const handleSurprisePick = async () => {
    cancelRestoreState(PICK_STATUS.LOADING);
    clearRestoreTimer();
    setPickValidation("");
    setOnboardingResultActive(false);
    setLastPickMode("surprise");
    setOriginalPickPrompt("");
    setSwapCount(0);
    setHasExpandedSwapPool(false);
    await submitPick(
      {
        prompt: "",
        source: "library",
      },
      {
        scrollToResults: true,
        refreshKey: `surprise-${Date.now()}`,
      },
      null,
      lastPickMeta
    );
  };

  const handleRetryPick = async () => {
    cancelRestoreState(activePick ? PICK_STATUS.READY : PICK_STATUS.IDLE);
    setPickError(null);

    if (lastPickMode === "surprise" && !originalPickPrompt.trim() && !pickPrompt.trim()) {
      clearRestoreTimer();
      setPickValidation("");
      setLastPickMode("surprise");
      setOriginalPickPrompt("");
      setSwapCount(0);
      setHasExpandedSwapPool(false);
      await submitPick(
        {
          prompt: "",
          source: "library",
        },
        {
          scrollToResults: true,
          refreshKey: `surprise-retry-${Date.now()}`,
        },
        null,
        lastPickMeta
      );
      return;
    }

    const nextPrompt = originalPickPrompt.trim() || pickPrompt.trim();
    if (!nextPrompt) {
      handleRefinePick();
      return;
    }

    setPickPrompt(nextPrompt);
    clearRestoreTimer();
    setPickValidation("");
    setLastPickMode("prompt");
    setOriginalPickPrompt(nextPrompt);
    setSwapCount(0);
    setHasExpandedSwapPool(false);
    await submitPick(
      { prompt: nextPrompt },
      { scrollToResults: true, refreshKey: `retry-${Date.now()}` },
      null,
      lastPickMeta
    );
  };

  const handleEmptyPickCta = () => {
    scrollToSection("pick-for-me", { skipIfVisible: true });
  };

  const handlePromptKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    cancelRestoreState(activePick ? PICK_STATUS.READY : PICK_STATUS.IDLE);
    if (!isPickBusy) {
      handlePickSubmit();
    }
  };

  const handleHeroSearch = (event) => {
    event.preventDefault();
    const nextQuery = query.trim();

    if (!nextQuery) {
      scrollToSection("pick-for-me");
      return;
    }

    navigate(`/search?q=${encodeURIComponent(nextQuery)}`);
  };

  const hasResettableDiscoveryState = Boolean(
    activePick
      || pickPrompt.trim()
      || originalPickPrompt.trim()
      || activePromptSuggestion
      || swapHistory.length
      || swapQueue.length
      || candidatePoolIds.length
      || refinementState
      || pickError
      || pickStatus !== PICK_STATUS.IDLE
      || onboardingVibeId
      || onboardingInteractionCount
      || onboardingResultActive
      || onboardingStep !== "intent"
  );

  return (
    <div className="browse-page home-page">
      <div className="container browse-shell home-shell">
        <section className={`browse-hero browse-hero--compact ${isCompactHeroPreview ? "browse-hero--solo" : "browse-hero--with-search"}`}>
          <div className="browse-copy">
            <div className="browse-kicker">ReelBot</div>
            <h1 className="browse-title browse-title--brand">{heroHeadline}</h1>
            <div className="browse-powered">Quick read. Strong pick.</div>
            <p className="browse-subtitle browse-subtitle--hero">
              {heroSubtext}
              {" "}
              <span className="browse-subtitle-break">{showOnboardingFlow ? "Browse if you want a wider search." : "Keep going with another pick, or browse wider."}</span>
            </p>
            <div className="hero-trust-signal">{heroSupportCopy}</div>

            <div className="browse-hero-actions">
              <a href={activePick ? "#your-pick" : "#pick-for-me"} className="reelbot-inline-button reelbot-inline-button--solid">
                {primaryHeroActionLabel}
              </a>
              {activePick ? (
                <button type="button" className="reelbot-inline-button" onClick={handleRefinePickForHero}>
                  Adjust your vibe
                </button>
              ) : null}
              {hasResettableDiscoveryState ? (
                <button type="button" className="reelbot-inline-button reelbot-inline-button--secondary" onClick={handleStartFresh}>
                  Start fresh
                </button>
              ) : null}
              <button type="button" className="reelbot-inline-button" onClick={() => setShowCapabilities(true)}>
                How it works
              </button>
            </div>
          </div>

          {!isCompactHeroPreview ? (
            <div className="browse-hero-aside">
              <form onSubmit={handleHeroSearch} className="search-bar search-bar--hero">
                <input
                  type="text"
                  placeholder="Try a title, actor, or vibe"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button type="submit">Search</button>
              </form>

              {heroPreviewMovies.length ? (
                <div className="hero-preview-card">
                  <div className="hero-preview-head">
                    <div className="detail-description-label">{heroPreviewLabel}</div>
                    <span className="results-count results-count--context">{heroPreviewMovies.length} picks</span>
                  </div>

                  <div className="hero-preview-grid">
                    {heroPreviewMovies.map((movie) => (
                      <Link key={movie.id} to={getMoviePath(movie)} className="hero-preview-item" aria-label={`Open ${movie.title}`}>
                        {movie.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                            alt={movie.title}
                            className="hero-preview-poster"
                          />
                        ) : (
                          <div className="hero-preview-poster hero-preview-poster--placeholder">Poster unavailable</div>
                        )}
                        <span className="hero-preview-title">{movie.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {showOnboardingFlow || showPromptComposerSection ? (
        <section id="pick-for-me" className="pick-for-me-card pick-for-me-card--primary">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <h2 className="section-title">{showOnboardingFlow ? "Get a pick" : "Find something worth watching"}</h2>
              <p className="section-subtitle">
                {showOnboardingFlow ? "Start with a vibe. We’ll do the rest." : "Describe the vibe and ReelBot will sharpen the next pick."}
              </p>
            </div>
          </div>

          {showOnboardingFlow ? (
            <div className={`quick-onboarding-shell quick-onboarding-shell--${onboardingStep}`}>
              <div className="quick-onboarding-content">
                <div className="quick-onboarding-head">
                  <div className="quick-onboarding-head-copy">
                    <div className="detail-description-label">
                      {onboardingStep === "complete" ? "YOUR FIRST PICK" : onboardingStep === "taste" ? "TASTE INPUT" : "YOUR VIBE"}
                    </div>
                    <h3 className="quick-onboarding-title">
                      {onboardingStep === "intent"
                        ? homeHeadline
                        : onboardingStep === "taste"
                          ? "Help me get a quick read on your taste"
                          : onboardingStep === "loading"
                            ? "Building your first pick"
                            : "This feels like you"}
                    </h3>
                    <p className="detail-secondary-text quick-onboarding-copy">
                      {onboardingStep === "intent"
                        ? "We’ll use this to shape your first pick."
                        : onboardingStep === "taste"
                          ? "Tap a few movies — no thinking required"
                          : onboardingStep === "loading"
                            ? "Reading your picks and lining up the best match."
                            : onboardingReasoning || "A sharper read based on the signals you gave ReelBot."}
                    </p>
                  </div>
                  {onboardingStep !== "intent" && onboardingStep !== "taste" ? (
                    <button type="button" className="reelbot-inline-button quick-onboarding-reset" onClick={handleRestartOnboarding}>
                      Start fresh
                    </button>
                  ) : null}
                </div>

                {onboardingStep === "intent" ? (
                  <>
                    <div className="quick-onboarding-vibe-grid" role="list" aria-label="Pick a vibe">
                      {[
                        { id: "easy_fun", label: "Easy watch" },
                        { id: "intense", label: "Something intense" },
                        { id: "thought_provoking", label: "Smart / twisty" },
                        { id: "emotional", label: "Emotional" },
                        { id: "surprise_me", label: "Surprise me" },
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`quick-onboarding-vibe-button${onboardingVibeId === option.id ? " is-active" : ""}`}
                          onClick={() => handleOnboardingVibeSelect(option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="quick-onboarding-footer">
                      <div className="quick-onboarding-footer-actions">
                        <button
                          type="button"
                          className="reelbot-inline-button reelbot-inline-button--solid"
                          onClick={handleOnboardingContinue}
                          disabled={!onboardingVibeId}
                        >
                          Continue
                        </button>
                      </div>
                      <button type="button" className="quick-onboarding-dismiss" onClick={handleDismissOnboarding}>
                        Skip for now
                      </button>
                    </div>
                  </>
                ) : null}

                {onboardingStep === "taste" ? (
                  onboardingPosterDeck.length ? (
                    <div className="quick-onboarding-taste-shell">
                      <div className="quick-onboarding-progress-row">
                        <div className="quick-onboarding-progress-copy">
                          <span className="quick-onboarding-progress-step">{onboardingInteractionCount} / {ONBOARDING_MIN_SIGNAL_COUNT} picks</span>
                          <span className="quick-onboarding-progress-note">{canFinishOnboarding ? "Enough signal. Keep going or continue." : `${onboardingRemainingCount} more to go`}</span>
                        </div>
                        <button type="button" className="reelbot-inline-button quick-onboarding-reset quick-onboarding-reset--inline" onClick={handleRestartOnboarding}>
                          Start fresh
                        </button>
                      </div>

                      <div className="quick-onboarding-grid">
                        {onboardingPosterDeck.map((movie) => {
                          const reactionState = onboardingLikedIds.includes(movie.id)
                            ? "like"
                            : onboardingDislikedIds.includes(movie.id)
                              ? "dislike"
                              : onboardingSkippedIds.includes(movie.id)
                                ? "skip"
                                : "";

                          return (
                            <article key={movie.id} className={`movie-card home-movie-card quick-onboarding-grid-card${reactionState ? ` is-${reactionState}` : ""}`}>
                              <div className="home-movie-card-link quick-onboarding-grid-shell">
                                <div className="home-movie-card-poster-shell quick-onboarding-grid-poster-shell">
                                  <span className="home-movie-card-label">{getPosterToneTag(movie, onboardingVibeId)}</span>
                                  <img
                                    src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                                    alt={movie.title}
                                    className="movie-poster"
                                  />
                                  <span className="home-movie-card-overlay" aria-hidden="true"></span>
                                </div>

                                <div className="movie-card-content quick-onboarding-grid-copy">
                                  <div className="movie-card-meta">
                                    <span className="movie-card-chip">{getReleaseYear(movie.release_date)}</span>
                                    {movie.vote_average ? <span className="movie-card-chip">TMDB {movie.vote_average.toFixed(1)}</span> : null}
                                  </div>
                                  <h4 className="movie-card-title quick-onboarding-grid-title">{movie.title}</h4>
                                  <p className="movie-card-date quick-onboarding-grid-date">{formatMovieDate(movie.release_date)}</p>
                                  <div className="quick-onboarding-grid-actions">
                                    <button
                                      type="button"
                                      aria-pressed={reactionState === "like"}
                                      className={`quick-onboarding-chip quick-onboarding-chip--like${reactionState === "like" ? " is-active" : ""}`}
                                      onClick={() => handleOnboardingReaction(movie.id, "like")}
                                    >
                                      Interested
                                    </button>
                                    <button
                                      type="button"
                                      aria-pressed={reactionState === "dislike"}
                                      className={`quick-onboarding-chip quick-onboarding-chip--dislike${reactionState === "dislike" ? " is-active" : ""}`}
                                      onClick={() => handleOnboardingReaction(movie.id, "dislike")}
                                    >
                                      Not for me
                                    </button>
                                    <button
                                      type="button"
                                      aria-pressed={reactionState === "skip"}
                                      className={`quick-onboarding-chip quick-onboarding-chip--skip${reactionState === "skip" ? " is-active" : ""}`}
                                      onClick={() => handleOnboardingReaction(movie.id, "skip")}
                                    >
                                      Skip
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>

                      <div className="quick-onboarding-footer">
                        <div className="detail-secondary-text quick-onboarding-footer-copy">{onboardingSignalSummary || "Pick a few posters and keep moving."}</div>
                        <div className="quick-onboarding-footer-actions">
                          {canFinishOnboarding ? (
                            <button type="button" className="reelbot-inline-button reelbot-inline-button--solid quick-onboarding-finish" onClick={() => handleOnboardingPick()}>
                              Continue
                            </button>
                          ) : (
                            <button type="button" className="reelbot-inline-button quick-onboarding-finish quick-onboarding-finish--pending" disabled>
                              {onboardingInteractionCount ? `Pick ${onboardingRemainingCount} more to continue` : `Pick ${ONBOARDING_MIN_SIGNAL_COUNT} to continue`}
                            </button>
                          )}
                        </div>
                      </div>
                      <button type="button" className="quick-onboarding-dismiss quick-onboarding-dismiss--footer" onClick={handleDismissOnboarding}>
                        Skip for now
                      </button>
                    </div>
                  ) : (
                    <div className="reelbot-loading-state onboarding-loading-state">
                      <span className="reelbot-loading-dot" aria-hidden="true"></span>
                      <div className="reelbot-loading-copy">
                        <p className="reelbot-loading-title">Loading your taste cards…</p>
                        <p className="detail-secondary-text reelbot-placeholder-copy">Pulling together a better mix.</p>
                      </div>
                    </div>
                  )
                ) : null}
              </div>

              {onboardingStep === "loading" || onboardingStep === "complete" ? (
                <div className="quick-onboarding-content quick-onboarding-content--status">
                  {onboardingStep === "loading" ? (
                    <div className="reelbot-loading-state onboarding-loading-state">
                      <span className="reelbot-loading-dot" aria-hidden="true"></span>
                      <div className="reelbot-loading-copy">
                        <p className="reelbot-loading-title">Finding your first pick…</p>
                        <p className="detail-secondary-text reelbot-placeholder-copy">
                          {onboardingVibe?.shortLabel ? `${onboardingVibe.shortLabel} locked.` : "Vibe locked."} {onboardingSignalSummary}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {onboardingStep === "complete" ? (
                    <div className="quick-onboarding-complete">
                      <div className="quick-onboarding-complete-copy">
                        <span className="quick-onboarding-complete-pill">{onboardingVibe?.shortLabel || "Ready"}</span>
                        <p className="detail-secondary-text quick-onboarding-complete-text">
                          {onboardingSignalSummary || "Taste saved."}
                        </p>
                      </div>
                      <button type="button" className="reelbot-inline-button" onClick={handleRestartOnboarding}>
                        Start fresh
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {showPromptComposerSection ? (
          <ReelbotPromptComposer
            inputId="pick-prompt-input"
            suggestions={visiblePromptSuggestions}
            activeSuggestion={activePromptSuggestion}
            value={pickPrompt}
            onSuggestionSelect={(value) => {
              cancelRestoreState(activePick ? PICK_STATUS.READY : PICK_STATUS.IDLE);
              setPickPrompt(value);
              setActivePromptSuggestion(value);
              if (pickValidation) {
                setPickValidation("");
              }
            }}
            onInputChange={(value) => {
              cancelRestoreState(activePick ? PICK_STATUS.READY : PICK_STATUS.IDLE);
              setPickPrompt(value);
              if (activePromptSuggestion && value.trim() !== activePromptSuggestion) {
                setActivePromptSuggestion("");
              }
              if (pickValidation) {
                setPickValidation("");
              }
            }}
            onKeyDown={handlePromptKeyDown}
            placeholder="Try a title, actor, or vibe"
            errorText={pickValidation}
          />
          ) : null}

          {showPromptComposerSection ? (
          <div className="pick-for-me-actions">
            <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={handlePickSubmit} disabled={isPickBusy}>
              {isPickLoading && lastPickMode === "prompt" ? "Getting a pick…" : "Get a pick"}
            </button>
            <button type="button" className="reelbot-inline-button reelbot-inline-button--secondary" onClick={handleSurprisePick} disabled={isPickBusy}>
              {isPickLoading && lastPickMode === "surprise" ? "Surprising you…" : "Surprise me"}
            </button>
          </div>
          ) : null}
        </section>
        ) : null}

        {shouldRenderPickResultSection ? (
        <section id="your-pick" ref={pickResultSectionRef} className="pick-result-section" aria-live="polite">
          <div id="pick-result" aria-hidden="true"></div>
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              {shouldShowFirstPickIntro ? <div className="detail-description-label">YOUR FIRST PICK</div> : null}
              <h2 className="section-title">{shouldShowFirstPickIntro ? "This feels like you" : isSessionHomepageUser ? "Your latest pick" : pickResultTitle}</h2>
              {activePick && !shouldShowFirstPickIntro ? <p className="section-subtitle">{pickResultSubtitle}</p> : null}
            </div>
          </div>

          {isSessionHomepageUser && activePick ? (
            <div className="session-save-nudge">
              <p className="session-save-nudge-copy">Save your picks across devices</p>
              <button type="button" className="reelbot-inline-button" onClick={() => openAuthPrompt("session_home_inline")}>
                Create account
              </button>
            </div>
          ) : null}

          <PickResultPanel
            panelStatus={pickStatus}
            loading={isPickLoading}
            error={pickStatus === PICK_STATUS.ERROR ? pickError : ""}
            rationale={resultRationale}
            summary={null}
            primaryMovie={activePick}
            backupMovies={backupPicksWithRoles}
            vibeLabel={pickVibeLabel}
            loadingCopy={pickLoadingMessageOverride || PICK_LOADING_MESSAGES[loadingMessageIndex] || "Evaluating candidates…"}
            emptyCopy="Nothing here yet. Give ReelBot a vibe and we'll line up your next watch."
            emptyActionLabel="Get a pick"
            onEmptyAction={handleEmptyPickCta}
            fallbackTitle={shouldShowPickFallbackState ? pickFallbackTitle : ""}
            fallbackCopy={shouldShowPickFallbackState ? pickFallbackCopy : ""}
            fallbackActionLabel={shouldShowPickFallbackState ? "Try again" : ""}
            onFallbackAction={shouldShowPickFallbackState ? handleRetryPick : undefined}
            fallbackSecondaryActionLabel={shouldShowPickFallbackState ? "Browse movies" : ""}
            fallbackSecondaryActionPath={shouldShowPickFallbackState ? browseLibraryPath : ""}
            primaryActionLabel={activePick ? "Movie details" : ""}
            onPrimaryAction={activePick ? () => {
              markFirstPickSummarySeen();
              navigate(getMoviePath(activePick), { state: { source: "reelbot_pick", restorePickSession: true } });
            } : undefined}
            showDetailLink={false}
            refreshLabel={isSwapLoading ? "Swapping…" : "Get another pick"}
            resetLabel="Start fresh"
            backupTitle="Similar picks, different vibes"
            onRefreshChoices={pickResult?.primary ? () => {
              markFirstPickSummarySeen();
              return handleRefreshPick();
            } : undefined}
            onResetChoices={activePick ? handleStartFresh : undefined}
            refreshDisabled={isPickBusy || candidatePoolExhausted}
            resetDisabled={false}
            recoveryTitle={pickRecoveryTitle}
            recoveryMessage={pickRecoveryMessage}
            onRefineVibe={activePick && !isPickBusy ? handleRefinePick : undefined}
            refineVibeLabel="Adjust your vibe"
            refineActions={activePick ? PICK_REFINE_ACTIONS : []}
            onRefineAction={activePick && !isPickBusy ? handleInlineRefinement : undefined}
            refineStatusLabel={inlineRefineStatus}
            browsePath={activePick && !isPickBusy ? browseLibraryPath : ""}
            hasActiveSession={hasActivePickSession}
            showEmptyState={shouldShowEmptyPickState}
            showSessionPlaceholder={shouldShowPickSessionPlaceholder}
            showExpandedReasoning
            tasteActionProps={{
              skipLabel: "Not for me",
              skipActiveLabel: "Not for me",
              onInteraction: markFirstPickSummarySeen,
            }}
            hideRefreshCta={refreshExhausted}
            refreshExhaustionMessage={refreshExhaustionMessage}
          />
        </section>
        ) : null}

        <div className="mode-divider" aria-hidden="true">
          <span className="mode-divider-line"></span>
          <span className="mode-divider-label">Explore Mode</span>
          <span className="mode-divider-line"></span>
        </div>

        <section className="explore-mode-shell">
          <div className="section-header section-header--compact section-header--stacked-mobile explore-mode-header">
            <div>
              <div className="detail-description-label">Explore</div>
              <h2 className="section-title">Explore Movies</h2>
              <p className="section-subtitle">Prefer browsing? Scan what’s in theaters, trending, or coming soon.</p>
            </div>
          </div>

          <section className="secondary-discovery-section">
            <div className="secondary-discovery-grid">
              <aside className="browse-library-card browse-library-card--secondary">
                <div className="detail-description-label">Browse Library</div>
                <h3 className="browse-library-title">Need a wider search?</h3>
                <p className="detail-secondary-text browse-library-copy">
                  Use Browse Library when you want more control over genre, runtime, and mood.
                </p>

                <div className="browse-library-links">
                  <Link to="/browse?view=popular&genre=878#library-results" className="browse-library-link">
                    Trending Sci-Fi
                  </Link>
                  <Link to="/browse?view=popular&runtime=under_two_hours#library-results" className="browse-library-link">
                    Under 100 Minutes
                  </Link>
                  <Link to="/browse?view=popular&genre=10749&runtime=under_two_hours#library-results" className="browse-library-link">
                    Date-Night Range
                  </Link>
                  <Link to="/browse?view=latest&mood=dark#library-results" className="browse-library-link">
                    Dark Now Playing
                  </Link>
                </div>

                <Link to="/browse" className="card-link browse-library-cta">
                  Browse Movies
                </Link>
              </aside>
            </div>
          </section>

          <div id="movie-grid" className="section-header section-header--stacked-mobile">
            <div>
              <h2 className="section-title">{heading}</h2>
              <p className="section-subtitle">{sectionSubtitle}</p>
              <div className="feed-showing-label">Showing: {selectedMood === "all" ? viewLabel : selectedMoodConfig.label}</div>
            </div>
            <div className="results-count">{feedCountDisplayLabel}</div>
          </div>

          <div className="tabs browse-tabs browse-tabs--secondary">
            {VIEW_OPTIONS.map((option) => (
              <button key={option.id} className={movieType === option.id ? "active" : ""} onClick={() => handleViewChange(option.id)}>
                {option.label}
              </button>
            ))}
          </div>

          <div className="mood-rail mood-rail--secondary mood-rail--grid" aria-label="Filter poster grid by mood">
            {MOOD_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`mood-rail-chip${selectedMood === filter.id ? " is-active" : ""}`}
                onClick={() => handleExploreMoodChange(filter.id)}
                title={filter.hint}
                aria-pressed={selectedMood === filter.id}
              >
                <span className="mood-rail-chip-label">{filter.label}</span>
              </button>
            ))}
          </div>
        {error && !hasVisibleFeedContent ? <p className="error-message">{error}</p> : null}

        {!error || hasVisibleFeedContent ? (
          <>
            <div className="movie-list home-poster-grid">
              {shouldShowFeedSkeletons ? (
                Array.from({ length: HOMEPAGE_BASE_DISPLAY_COUNT }).map((_, index) => (
                  <article key={`feed-skeleton-${index}`} className="movie-card home-movie-card home-movie-card--skeleton" aria-hidden="true">
                    <div className="home-movie-card-link">
                      <div className="home-movie-card-poster-shell home-feed-skeleton-block home-feed-skeleton-poster">
                        <span className="home-movie-card-label home-feed-skeleton-line home-feed-skeleton-line--chip"></span>
                        <span className="home-movie-card-overlay" aria-hidden="true"></span>
                      </div>

                      <div className="movie-card-content">
                        <div className="movie-card-meta">
                          <span className="movie-card-chip home-feed-skeleton-line home-feed-skeleton-line--chip"></span>
                          <span className="movie-card-chip home-feed-skeleton-line home-feed-skeleton-line--chip"></span>
                        </div>

                        <div className="home-feed-skeleton-line home-feed-skeleton-line--title"></div>
                        <div className="home-feed-skeleton-line home-feed-skeleton-line--date"></div>
                      </div>
                    </div>
                  </article>
                ))
              ) : displayedMovies.length > 0 ? (
                displayedMovies.map((movie) => (
                  <article key={movie.id} className="movie-card home-movie-card">
                    <Link to={getMoviePath(movie)} className="home-movie-card-link" aria-label={`Open ${movie.title}`}>
                      <div className="home-movie-card-poster-shell">
                        <span className="home-movie-card-label">{getHomepageCardLabel(movie, movieType)}</span>
                        {movie.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                            alt={movie.title}
                            className="movie-poster"
                          />
                        ) : (
                          <div className="no-poster">Poster unavailable</div>
                        )}
                        <span className="home-movie-card-overlay" aria-hidden="true"></span>
                      </div>

                      <div className="movie-card-content">
                        <div className="movie-card-meta">
                          <span className="movie-card-chip">{getReleaseYear(movie.release_date)}</span>
                          {movie.vote_average ? <span className="movie-card-chip">TMDB {movie.vote_average.toFixed(1)}</span> : null}
                          {seenMovieIds.has(movie.id) ? (
                            <span className="movie-card-chip movie-card-chip--seen">Seen before</span>
                          ) : null}
                        </div>

                        <h3 className="movie-card-title">{movie.title}</h3>
                        <p className="movie-card-date">{formatMovieDate(movie.release_date)}</p>
                      </div>
                    </Link>
                  </article>
                ))
              ) : (
                <div className="empty-state feed-empty-state">
                  <span className="status-glyph" aria-hidden="true"></span>
                  <span>{selectedMood === "all" ? "Nothing is landing in this feed right now." : "Nothing in this feed fits that mood right now."}</span>
                  <Link to={browseLibraryResultsPath} className="card-link">
                    Browse Movies
                  </Link>
                </div>
              )}
            </div>

            {selectedMood !== "all" && displayedMovies.length > 0 && displayedMovies.length < 8 ? (
              <div className="feed-followup-card">
                <div>
                  <div className="detail-description-label">Want more {selectedMoodConfig.label.toLowerCase()} picks?</div>
                  <p className="detail-secondary-text">
                    This homepage feed is just a slice of the lineup. Browse Library goes wider when you want more options.
                  </p>
                </div>
                <Link to={browseLibraryResultsPath} className="card-link">
                  Browse Movies
                </Link>
              </div>
            ) : null}
          </>
        ) : null}

        {totalPages > 1 ? (
          <div className="pagination browse-pagination">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage((previous) => previous - 1)}>
              ⬅ Previous
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((previous) => previous + 1)}>
              Next ➡
            </button>
          </div>
        ) : null}
        </section>
      </div>

      <TrailerModal
        isOpen={isPickTrailerOpen}
        video={activePick?.trailer || null}
        movieTitle={activePick?.title || ""}
        onClose={() => setIsPickTrailerOpen(false)}
      />

      {showCapabilities ? (
        <div className="reelbot-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reelbot-modal-title">
          <div className="reelbot-modal">
            <button
              type="button"
              className="reelbot-modal-close"
              onClick={() => setShowCapabilities(false)}
              aria-label="Close ReelBot capabilities"
            >
              ×
            </button>

            <div className="reelbot-modal-kicker">Ask when you want clarity</div>
            <h2 id="reelbot-modal-title" className="reelbot-modal-title">
              How ReelBot helps you decide
            </h2>
            <p className="reelbot-modal-copy">Browse on your own first, then use ReelBot when you want a faster read, a stronger pick, or help breaking a tie.</p>

            <div className="reelbot-modal-grid">
              {REELBOT_CAPABILITIES.map((capability) => (
                <div key={capability.title} className="reelbot-modal-card">
                  <div className="reelbot-modal-card-title">{capability.title}</div>
                  <p className="reelbot-modal-card-copy">{capability.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Home;
