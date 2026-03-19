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
import useTasteProfile from "./hooks/useTasteProfile";
import { buildRecommendationRationale, getBackupRoleLabel } from "./recommendationInsights";
import { buildBreadcrumbJsonLd, buildItemListJsonLd, usePageMetadata } from "./seo";
import { buildAbsoluteUrl, DEFAULT_SOCIAL_IMAGE, SITE_DESCRIPTION, SITE_NAME } from "./siteConfig";
import { tasteProfileService } from "./services/tasteProfileService";

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

function Home({ routeView = "latest", isFeedRoute = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialPickSessionRef = useRef(null);

  if (initialPickSessionRef.current === null) {
    initialPickSessionRef.current = tasteProfileService.loadHomePickSession() || {};
  }

  const initialPickSession = initialPickSessionRef.current;

  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movieType, setMovieType] = useState(routeView);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedMood, setSelectedMood] = useState("all");
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [pickPrompt, setPickPrompt] = useState(() => String(initialPickSession.pickPrompt || ""));
  const [activePromptSuggestion, setActivePromptSuggestion] = useState("");
  const [pickLoading, setPickLoading] = useState(false);
  const [pickError, setPickError] = useState(null);
  const [pickValidation, setPickValidation] = useState("");
  const [pickResult, setPickResult] = useState(() => initialPickSession.pickResult || null);
  const [lastPickMode, setLastPickMode] = useState(() => (initialPickSession.lastPickMode === "surprise" ? "surprise" : "prompt"));
  const [swapCount, setSwapCount] = useState(() => Number(initialPickSession.swapCount || 0));
  const [hasExpandedSwapPool, setHasExpandedSwapPool] = useState(() => Boolean(initialPickSession.hasExpandedSwapPool));
  const [pickLoadingMessageOverride, setPickLoadingMessageOverride] = useState("");
  const [visiblePromptSuggestions, setVisiblePromptSuggestions] = useState(() => pickPromptSuggestions(HOMEPAGE_PROMPT_POOL, HOMEPAGE_PROMPT_COUNT));
  const pickResultSectionRef = useRef(null);
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
  const { profile, actions: tasteActions, getPickExcludedIds } = useTasteProfile();

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

  const restoreHomePickSession = () => {
    const storedSession = tasteProfileService.loadHomePickSession();
    if (!storedSession) {
      return false;
    }

    setPickPrompt(String(storedSession.pickPrompt || ""));
    setPickResult(storedSession.pickResult || null);
    setLastPickMode(storedSession.lastPickMode === "surprise" ? "surprise" : "prompt");
    setSwapCount(Number(storedSession.swapCount || 0));
    setHasExpandedSwapPool(Boolean(storedSession.hasExpandedSwapPool));
    setPickError(null);
    setPickValidation("");
    return Boolean(storedSession.pickResult?.primary);
  };

  useEffect(() => {
    setMovieType(routeView);
    setCurrentPage(1);
  }, [routeView]);

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
      if (targetId === "pick-result") {
        scrollToPickResults();
        return;
      }

      scrollToSection(targetId);
    }, 90);

    return () => window.clearTimeout(timeoutId);
  }, [location.hash, loading, movieType, scrollToPickResults, scrollToSection]);

  useEffect(() => {
    if (!location.state?.restorePickSession && !location.state?.scrollToPickResult) {
      return;
    }

    restoreHomePickSession();
    const timeoutId = window.setTimeout(() => {
      scrollToPickResults();
    }, 90);

    navigate(`${location.pathname}${location.hash || ""}`, { replace: true, state: {} });
    return () => window.clearTimeout(timeoutId);
  }, [location.hash, location.pathname, location.state, navigate, scrollToPickResults]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const fetchFeed = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/movies?type=${movieType}&page=${currentPage}&fill=1`);
        setMovies(
          (response.data.results || []).map((movie) => ({
            ...movie,
            homepage_feed_source: movie.source_type || movieType,
          }))
        );
        setTotalPages(response.data.total_pages || 1);
      } catch (requestError) {
        console.error(`Error fetching ${movieType} movies:`, requestError);
        setError(`Failed to fetch ${movieType} movies.`);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
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
    setPickResult(null);
    setSwapCount(0);
    setHasExpandedSwapPool(false);
    setPickLoadingMessageOverride("");
    setActivePromptSuggestion("");
  }, [movieType]);

  useEffect(() => {
    if (!pickLoading) {
      setLoadingMessageIndex(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setLoadingMessageIndex((currentIndex) => (currentIndex + 1) % PICK_LOADING_MESSAGES.length);
    }, 1400);

    return () => window.clearInterval(intervalId);
  }, [pickLoading]);

  useEffect(() => {
    if (pickPrompt.trim() || activePromptSuggestion || pickLoading) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setVisiblePromptSuggestions((currentSuggestions) => pickPromptSuggestions(HOMEPAGE_PROMPT_POOL, HOMEPAGE_PROMPT_COUNT, currentSuggestions));
    }, PROMPT_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [activePromptSuggestion, pickLoading, pickPrompt]);

  useEffect(() => {
    if (!pickResult?.primary) {
      tasteProfileService.clearHomePickSession();
      return;
    }

    tasteProfileService.saveHomePickSession({
      pickPrompt,
      pickResult,
      lastPickMode,
      swapCount,
      hasExpandedSwapPool,
    });
  }, [hasExpandedSwapPool, lastPickMode, pickPrompt, pickResult, swapCount]);

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

  const hiddenMovieIds = useMemo(() => new Set((profile.skipped || []).map((item) => item.id)), [profile]);
  const visibleMovies = useMemo(() => movies.filter((movie) => !hiddenMovieIds.has(movie.id)), [hiddenMovieIds, movies]);
  const curatedMovies = useMemo(() => {
    const qualityFiltered = visibleMovies.filter((movie) => passesFeedQualityCheck(movie, movieType));
    const fallbackPool = qualityFiltered.length >= Math.min(MIN_CURATED_FEED_SIZE, visibleMovies.length) ? qualityFiltered : visibleMovies;

    return [...fallbackPool].sort((leftMovie, rightMovie) => getFeedCurationScore(rightMovie, movieType) - getFeedCurationScore(leftMovie, movieType));
  }, [movieType, visibleMovies]);

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

  const feedCountLabel = selectedMood === "all" ? `${displayedMovies.length} curated titles` : `${displayedMovies.length} curated matches`;
  const heroPreviewLabel = movieType === "upcoming" ? "Coming soon" : movieType === "popular" ? "Trending this week" : "Now playing";
  const browseLibraryPath = `/browse${selectedMood !== "all" ? `?mood=${selectedMood}` : ""}`;
  const browseLibraryResultsPath = `${browseLibraryPath}${browseLibraryPath.includes("?") ? "&" : "?"}view=${movieType}#library-results`;
  const activePick = pickResult?.primary || null;
  const backupPicks = useMemo(() => pickResult?.alternates || [], [pickResult]);
  const recommendationRationale = useMemo(
    () => buildRecommendationRationale({ pickResult, activePick, profile, surpriseMode: lastPickMode === "surprise" }),
    [pickResult, activePick, profile, lastPickMode]
  );
  const backupPicksWithRoles = useMemo(
    () => backupPicks.map((movie, index) => ({ ...movie, backupRole: movie.backupRole || getBackupRoleLabel(movie, index) })),
    [backupPicks]
  );
  const persistentExcludedIds = useMemo(
    () =>
      Array.from(
        new Set([...(profile.skipped || []).map((item) => item.id), ...(profile.seen || []).map((item) => item.id)].filter(Boolean))
      ),
    [profile.seen, profile.skipped]
  );
  const showSwapRecoveryMessage = Boolean(activePick && hasExpandedSwapPool);

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
          title: "ReelBot — AI Movie Picker | Find What to Watch Tonight",
          description:
            "Find what to watch tonight with ReelBot — an AI-powered movie picker that delivers fast recommendations, spoiler-light insights, and smarter next-watch suggestions.",
          path: "/",
          image: DEFAULT_SOCIAL_IMAGE,
          structuredData: homeStructuredData,
        }
  );

  const pickVibeLabel = useMemo(() => pickPrompt.trim(), [pickPrompt]);

  const requestPick = async (nextPreferences, options = {}) => {
    try {
      setPickLoading(true);
      setPickLoadingMessageOverride(options.loadingMessage || "");
      setPickError(null);
      setPickValidation("");
      tasteActions.savePickPreferences(nextPreferences);

      if (options.scrollToResults) {
        scrollToPickResults();
      }

      const requestPayload = {
        ...nextPreferences,
        excluded_ids: options.customExcludedIds || getPickExcludedIds(nextPreferences, options.extraExcludedIds || []),
        trigger: "user_click",
      };

      if (options.intentSnapshot || pickResult?.resolved_intent) {
        requestPayload.intent_snapshot = options.intentSnapshot || pickResult?.resolved_intent;
      }

      if (!options.disableCandidatePoolReuse && (options.candidatePoolIds || pickResult?.candidate_pool_ids)) {
        requestPayload.candidate_pool_ids = options.candidatePoolIds || pickResult?.candidate_pool_ids;
      }

      if (options.refreshKey) {
        requestPayload.refresh_key = options.refreshKey;
      }

      const response = await axios.post(`${API_BASE_URL}/reelbot/pick`, requestPayload, {
        headers: {
          "X-ReelBot-Trigger": "user_click",
        },
      });

      setPickResult(response.data);
      tasteActions.recordPickResult(nextPreferences, response.data);

      if (options.scrollToResults) {
        scrollToPickResults({ skipIfVisible: true });
      }
    } catch (requestError) {
      console.error("Error fetching ReelBot pick:", requestError);
      setPickError("ReelBot could not pull a pick right now.");
    } finally {
      setPickLoading(false);
      setPickLoadingMessageOverride("");
    }
  };

  const submitPick = async (overrides = {}, options = {}) => {
    const nextPreferences = {
      view: movieType,
      mood: "all",
      runtime: "any",
      source: "feed",
      company: "any",
      prompt: pickPrompt,
      ...overrides,
    };

    if (Object.prototype.hasOwnProperty.call(overrides, "prompt")) {
      setPickPrompt(nextPreferences.prompt);
    }

    await requestPick(nextPreferences, options);
  };

  const handleRefreshPick = async () => {
    if (pickLoading || !pickResult?.primary) {
      return;
    }

    const currentDeckIds = [pickResult?.primary?.id, ...((pickResult?.alternates || []).map((movie) => movie.id))].filter(Boolean);
    const nextSwapCount = swapCount + 1;
    const shouldExpandSearch = nextSwapCount > SWAP_SOFT_EXHAUSTION_THRESHOLD;

    setSwapCount(nextSwapCount);
    setHasExpandedSwapPool(shouldExpandSearch);

    await submitPick(
      {},
      {
        scrollToResults: true,
        extraExcludedIds: currentDeckIds,
        customExcludedIds: shouldExpandSearch ? [...persistentExcludedIds, ...currentDeckIds] : undefined,
        disableCandidatePoolReuse: shouldExpandSearch,
        loadingMessage: shouldExpandSearch ? EXPANDED_SWAP_LOADING_MESSAGE : "",
        refreshKey: shouldExpandSearch ? `expanded-${Date.now()}` : Date.now(),
      }
    );
  };

  const handlePickSubmit = async () => {
    if (!pickPrompt.trim()) {
      setPickValidation("Enter a vibe or choose Surprise Me.");
      return;
    }

    setLastPickMode("prompt");
    setSwapCount(0);
    setHasExpandedSwapPool(false);
    await submitPick({}, { scrollToResults: true });
  };

  const handleSurprisePick = async () => {
    setPickValidation("");
    setLastPickMode("surprise");
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
      }
    );
  };

  const handleEmptyPickCta = () => {
    scrollToSection("pick-for-me", { skipIfVisible: true });
  };

  const handleRefinePick = () => {
    scrollToSection("pick-for-me", { skipIfVisible: true });
    window.setTimeout(() => {
      document.getElementById("pick-prompt-input")?.focus();
    }, 140);
  };

  const handlePromptKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (!pickLoading) {
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

  return (
    <div className="browse-page home-page">
      <div className="container browse-shell home-shell">
        <section className={`browse-hero browse-hero--compact ${isCompactHeroPreview ? "browse-hero--solo" : "browse-hero--with-search"}`}>
          <div className="browse-copy">
            <div className="browse-kicker">ReelBot</div>
            <h1 className="browse-title browse-title--brand">What should I watch tonight?</h1>
            <div className="browse-powered">Fast feeds. Better picks. Less second-guessing.</div>
            <p className="browse-subtitle browse-subtitle--hero">
              Tell ReelBot the vibe and get a fast, confident pick.
              <span className="browse-subtitle-break">Browse if you want to widen the search.</span>
            </p>
            <div className="hero-trust-signal">Powered by TMDB data and AI recommendations.</div>

            <div className="browse-hero-actions">
              <a href="#pick-for-me" className="reelbot-inline-button reelbot-inline-button--solid">
                Get a Pick
              </a>
              <button type="button" className="reelbot-inline-button" onClick={() => setShowCapabilities(true)}>
                See how ReelBot helps
              </button>
            </div>
          </div>

          {!isCompactHeroPreview ? (
            <div className="browse-hero-aside">
              <form onSubmit={handleHeroSearch} className="search-bar search-bar--hero">
                <input
                  type="text"
                  placeholder="Try a title, actor, or vibe..."
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

        <section id="pick-for-me" className="pick-for-me-card pick-for-me-card--primary">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <h2 className="section-title">Find Your Next Watch</h2>
              <p className="section-subtitle">Describe the vibe, or tap a prompt to get started.</p>
            </div>
          </div>

          <ReelbotPromptComposer
            inputId="pick-prompt-input"
            suggestions={visiblePromptSuggestions}
            activeSuggestion={activePromptSuggestion}
            value={pickPrompt}
            onSuggestionSelect={(value) => {
              setPickPrompt(value);
              setActivePromptSuggestion(value);
              if (pickValidation) {
                setPickValidation("");
              }
            }}
            onInputChange={(value) => {
              setPickPrompt(value);
              if (activePromptSuggestion && value.trim() !== activePromptSuggestion) {
                setActivePromptSuggestion("");
              }
              if (pickValidation) {
                setPickValidation("");
              }
            }}
            onKeyDown={handlePromptKeyDown}
            placeholder="fun date night movie, something tense but not depressing, smart sci-fi, easy watch comedy"
            errorText={pickValidation}
          />

          <div className="pick-for-me-actions">
            <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={handlePickSubmit} disabled={pickLoading}>
              {pickLoading && lastPickMode === "prompt" ? "Getting Your Pick…" : "Get a Pick"}
            </button>
            <button type="button" className="reelbot-inline-button reelbot-inline-button--secondary" onClick={handleSurprisePick} disabled={pickLoading}>
              {pickLoading && lastPickMode === "surprise" ? "Surprising You…" : "Surprise Me"}
            </button>
          </div>
        </section>

        <section id="pick-result" ref={pickResultSectionRef} className="pick-result-section" aria-live="polite">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <h2 className="section-title">Your pick</h2>
              {activePick ? <p className="section-subtitle">A strong first pick, with a few nearby alternatives.</p> : null}
            </div>
          </div>

          <PickResultPanel
            loading={pickLoading}
            error={pickError}
            rationale={recommendationRationale}
            summary={null}
            primaryMovie={activePick}
            backupMovies={backupPicksWithRoles}
            vibeLabel={pickVibeLabel}
            loadingCopy={pickLoadingMessageOverride || PICK_LOADING_MESSAGES[loadingMessageIndex] || "Evaluating candidates…"}
            emptyCopy="Nothing here yet. Give ReelBot a vibe and we'll line up your next watch."
            emptyActionLabel="Get a Pick"
            onEmptyAction={handleEmptyPickCta}
            refreshLabel="Swap Pick"
            backupTitle="Similar picks, different vibes"
            onRefreshChoices={pickResult?.primary ? handleRefreshPick : undefined}
            refreshDisabled={pickLoading}
            recoveryMessage={showSwapRecoveryMessage ? SOFT_SWAP_MESSAGE : ""}
            onRefineVibe={showSwapRecoveryMessage ? handleRefinePick : undefined}
            browsePath={showSwapRecoveryMessage ? browseLibraryPath : ""}
            showExpandedReasoning
          />
        </section>

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
            <div className="results-count">{feedCountLabel}</div>
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
        {loading && (
          <div className="loading-message">
            <span className="status-glyph" aria-hidden="true"></span>
            <span>Loading movies...</span>
          </div>
        )}
        {error && <p className="error-message">{error}</p>}

        {!loading && !error && (
          <>
            <div className="movie-list home-poster-grid">
              {displayedMovies.length > 0 ? (
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
        )}

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
