export const API_BASE_URL = process.env.REACT_APP_API_URL;

export const VIEW_OPTIONS = [
  { id: "latest", label: "Now Playing" },
  { id: "popular", label: "Popular" },
  { id: "upcoming", label: "Coming Soon" },
];

export const VALID_VIEWS = new Set([...VIEW_OPTIONS.map((option) => option.id), "now_playing"]);

export const MOOD_FILTERS = [
  {
    id: "all",
    label: "All",
    hint: "No mood filter",
    predicate: () => true,
  },
  {
    id: "easy_watch",
    label: "Easy Watch",
    hint: "Lighter, low-friction picks",
    predicate: (movie) => [35, 10751, 16, 10749, 12].some((genreId) => movie.genre_ids?.includes(genreId)),
  },
  {
    id: "mind_bending",
    label: "Smart / Twisty",
    hint: "Ideas, twists, and strange energy",
    predicate: (movie) => [878, 9648, 53].some((genreId) => movie.genre_ids?.includes(genreId)),
  },
  {
    id: "dark",
    label: "Dark",
    hint: "Tense, eerie, or gritty",
    predicate: (movie) => [27, 53, 80].some((genreId) => movie.genre_ids?.includes(genreId)),
  },
  {
    id: "funny",
    label: "Funny",
    hint: "Comedy-forward watches",
    predicate: (movie) => movie.genre_ids?.includes(35),
  },
  {
    id: "feel_something",
    label: "Emotional",
    hint: "Moving, reflective, or romantic",
    predicate: (movie) => [18, 10749, 10402, 16].some((genreId) => movie.genre_ids?.includes(genreId)),
  },
];

export const PICK_RUNTIME_OPTIONS = [
  { id: "any", label: "Any length" },
  { id: "under_two_hours", label: "Under 2 hours" },
  { id: "over_two_hours", label: "2+ hours" },
];

export const PICK_COMPANY_OPTIONS = [
  { id: "any", label: "Any setup" },
  { id: "solo", label: "Solo" },
  { id: "pair", label: "Date night" },
  { id: "friends", label: "With friends" },
];

export const DISCOVERY_PROMPTS = [
  "Something tense but not miserable",
  "An easy date-night watch",
  "Smart and twisty with real payoff",
  "Funny and good with friends",
];

export const REELBOT_CAPABILITIES = [
  {
    title: "Quick Take",
    description: "Get the fast spoiler-light read on tone, audience fit, and whether this feels right for tonight.",
  },
  {
    title: "Pick for Me",
    description: "Share the vibe and ReelBot gives you one best-fit pick plus a few strong backups.",
  },
  {
    title: "Viewer Q&A",
    description: "Ask quick questions like Is it scary?, Is it slow?, or Is this a good date-night watch?",
  },
  {
    title: "Why Watch It",
    description: "Get the case for why this is worth the runtime — or why it might not be.",
  },
  {
    title: "The Split",
    description: "See what viewers praise most — and what turns others off.",
  },
  {
    title: "Similar Picks",
    description: "Get better next-watch ideas with short reasoning, not just lookalikes.",
  },
];

export const getViewLabel = (view) => {
  if (view === "now_playing") {
    return "Now Playing";
  }

  return VIEW_OPTIONS.find((option) => option.id === view)?.label || "Now Playing";
};

export const getReleaseYear = (releaseDate) => (releaseDate ? new Date(releaseDate).getFullYear() : "TBA");

export const slugifyMovieTitle = (title) =>
  String(title || "movie")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "movie";

export const getMoviePath = (movieOrId, title) => {
  if (typeof movieOrId === "object" && movieOrId !== null) {
    return `/movies/${movieOrId.id}/${slugifyMovieTitle(movieOrId.title)}`;
  }

  return `/movies/${movieOrId}/${slugifyMovieTitle(title)}`;
};

export const formatMovieDate = (releaseDate) =>
  releaseDate
    ? new Date(releaseDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Release date unavailable";
