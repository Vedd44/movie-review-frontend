import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import TasteActionBar from "./components/TasteActionBar";
import useTasteProfile from "./hooks/useTasteProfile";
import WatchAvailability from "./components/WatchAvailability";
import TrailerModal from "./components/TrailerModal";
import ReelbotStructuredContent from "./components/ReelbotStructuredContent";
import { getMoviePath, slugifyMovieTitle } from "./discovery";
import { buildDetailVerdict } from "./detailDecision";
import { buildBreadcrumbJsonLd, usePageMetadata } from "./seo";
import { buildAbsoluteUrl } from "./siteConfig";
import { tasteProfileService } from "./services/tasteProfileService";

const REELBOT_ACTIONS = {
  quick_take: {
    id: "quick_take",
    label: "Quick Take",
    hint: "A spoiler-light read on tone, pace, and who it's for.",
    panelTitle: "Quick Take",
    panelKicker: "Start Here",
    featured: true,
  },
  is_this_for_me: {
    id: "is_this_for_me",
    label: "Is This For Me?",
    hint: "Who it works for, and who may want something else.",
    panelTitle: "Is This For Me?",
    panelKicker: "Audience Fit",
  },
  why_watch: {
    id: "why_watch",
    label: "Why Watch It",
    hint: "The clearest case for why this might be worth your time.",
    panelTitle: "Why Watch It",
    panelKicker: "Worth Your Time?",
  },
  best_if_you_want: {
    id: "best_if_you_want",
    label: "Best If You Want",
    hint: "Fast decision bullets for tone, pacing, and commitment.",
    panelTitle: "Best If You Want",
    panelKicker: "Decision Helper",
  },
  similar_picks: {
    id: "similar_picks",
    label: "Keep the vibe going",
    hint: "Role-aware nearby picks instead of generic lookalikes.",
    panelTitle: "Keep the vibe going",
    panelKicker: "What To Watch Next",
  },
  scary_check: {
    id: "scary_check",
    label: "Is it scary?",
    panelTitle: "Is It Scary?",
    panelKicker: "Viewer Q&A",
  },
  pace_check: {
    id: "pace_check",
    label: "Is it slow?",
    panelTitle: "Is It Slow?",
    panelKicker: "Viewer Q&A",
  },
  best_mood: {
    id: "best_mood",
    label: "Best mood for this?",
    panelTitle: "Best Mood For This",
    panelKicker: "Viewer Q&A",
  },
  date_night: {
    id: "date_night",
    label: "Good date-night watch?",
    panelTitle: "Good Date-Night Watch?",
    panelKicker: "Viewer Q&A",
  },
  spoiler_synopsis: {
    id: "spoiler_synopsis",
    label: "Spoiler Synopsis",
    panelTitle: "Full Spoiler Synopsis",
    panelKicker: "Spoiler Corner",
    warning: "Contains spoilers",
  },
  ending_explained: {
    id: "ending_explained",
    label: "Ending",
    panelTitle: "Ending Explained",
    panelKicker: "Spoiler Corner",
    warning: "Spoilers ahead",
  },
  themes_and_takeaways: {
    id: "themes_and_takeaways",
    label: "Themes",
    panelTitle: "Themes & Takeaways",
    panelKicker: "Spoiler Corner",
    warning: "Spoilers possible",
  },
  debate_club: {
    id: "debate_club",
    label: "What people debate",
    panelTitle: "What People Debate",
    panelKicker: "Spoiler Corner",
    warning: "Spoiler-friendly",
  },
};

const UPCOMING_ACTION_OVERRIDES = {
  quick_take: {
    label: "First Look",
    hint: "What the synopsis, cast, and early details suggest so far.",
    panelTitle: "First Look",
    panelKicker: "Preview Mode",
  },
  is_this_for_me: {
    label: "Who's It For?",
    hint: "Who it seems best for based on what's been shared so far.",
    panelTitle: "Who's It For?",
    panelKicker: "Audience Read",
  },
  why_watch: {
    label: "Why It's on the Radar",
    hint: "Why people may be excited about it before release.",
    panelTitle: "Why It's on the Radar",
    panelKicker: "Why It's Buzzing",
  },
  similar_picks: {
    label: "While You Wait",
    hint: "What to watch now if this is already on your list.",
    panelTitle: "What To Watch While You Wait",
    panelKicker: "While You Wait",
  },
  scary_check: {
    label: "How intense does it look?",
    panelTitle: "How Intense Does It Look?",
    panelKicker: "Preview Q&A",
  },
  pace_check: {
    label: "How big does it seem?",
    panelTitle: "How Big Does It Seem?",
    panelKicker: "Preview Q&A",
  },
  best_mood: {
    label: "Best opening-week mood?",
    panelTitle: "Best Opening-Week Mood",
    panelKicker: "Preview Q&A",
  },
  date_night: {
    label: "Worth planning around?",
    panelTitle: "Worth Planning Around?",
    panelKicker: "Preview Q&A",
  },
};

const DETAIL_PRIMARY_ACTION_IDS = ["quick_take", "is_this_for_me", "why_watch"];
const RELEASED_SECONDARY_ACTION_IDS = ["spoiler_synopsis", "similar_picks"];
const UPCOMING_SECONDARY_ACTION_IDS = ["similar_picks"];
const RELEASED_SPOILER_ACTION_IDS = ["spoiler_synopsis", "ending_explained", "themes_and_takeaways", "debate_club"];
const PANEL_SCROLL_OFFSET = 112;
const DETAIL_ANCHOR_OFFSET = 110;
const DEFAULT_REELBOT_ERROR = "ReelBot hit a snag on that answer. Please try again.";

const summarizeList = (items = [], limit = 3) => {

  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  const visibleItems = items.slice(0, limit);
  const remainingCount = items.length - visibleItems.length;

  return remainingCount > 0 ? `${visibleItems.join(", ")} +${remainingCount} more` : visibleItems.join(", ");
};

const includesAnyGenre = (genres, values) => values.some((value) => genres.includes(value));

const getReleaseDateObject = (movie) => {
  if (!movie?.release_date) {
    return null;
  }

  const parsedDate = new Date(movie.release_date);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const isUpcomingMovie = (movie) => {
  const releaseDate = getReleaseDateObject(movie);
  const now = new Date();

  if (movie?.status && movie.status !== "Released") {
    return true;
  }

  return Boolean(releaseDate && releaseDate > now);
};

const formatReleaseDate = (value) => {
  if (!value) {
    return "TBA";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "TBA";
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  if (!amount) {
    return "";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: amount >= 100000000 ? "compact" : "standard",
    maximumFractionDigits: amount >= 100000000 ? 1 : 0,
  }).format(amount);
};

const getActionConfigMap = (previewMode) =>
  Object.fromEntries(
    Object.entries(REELBOT_ACTIONS).map(([actionId, action]) => [
      actionId,
      {
        ...action,
        ...(previewMode ? UPCOMING_ACTION_OVERRIDES[actionId] || {} : {}),
      },
    ])
  );

const getFollowUpActionIds = (actionId, previewMode) => {
  if (previewMode) {
    const previewMap = {
      quick_take: ["is_this_for_me", "best_if_you_want", "similar_picks"],
      is_this_for_me: ["why_watch", "best_if_you_want", "date_night"],
      why_watch: ["best_if_you_want", "similar_picks", "pace_check"],
      best_if_you_want: ["quick_take", "why_watch", "similar_picks"],
      similar_picks: ["quick_take", "is_this_for_me", "best_if_you_want"],
      scary_check: ["quick_take", "is_this_for_me", "why_watch"],
      pace_check: ["quick_take", "best_mood", "similar_picks"],
      best_mood: ["quick_take", "date_night", "similar_picks"],
      date_night: ["is_this_for_me", "best_mood", "why_watch"],
    };

    return previewMap[actionId] || ["quick_take", "is_this_for_me", "similar_picks"];
  }

  const releasedMap = {
    quick_take: ["is_this_for_me", "best_if_you_want", "similar_picks"],
    is_this_for_me: ["why_watch", "best_if_you_want", "date_night"],
    why_watch: ["is_this_for_me", "best_if_you_want", "similar_picks"],
    best_if_you_want: ["quick_take", "why_watch", "similar_picks"],
    similar_picks: ["why_watch", "best_if_you_want", "date_night"],
    scary_check: ["quick_take", "is_this_for_me", "why_watch"],
    pace_check: ["quick_take", "best_mood", "similar_picks"],
    best_mood: ["quick_take", "date_night", "similar_picks"],
    date_night: ["is_this_for_me", "best_mood", "why_watch"],
    spoiler_synopsis: ["ending_explained", "themes_and_takeaways", "debate_club"],
    ending_explained: ["themes_and_takeaways", "debate_club", "spoiler_synopsis"],
    themes_and_takeaways: ["debate_club", "ending_explained", "spoiler_synopsis"],
    debate_club: ["themes_and_takeaways", "ending_explained", "spoiler_synopsis"],
  };

  return releasedMap[actionId] || ["is_this_for_me", "best_mood", "similar_picks"];
};

const getTimeCommitment = (runtime) => {
  const minutes = Number(runtime || 0);

  if (!minutes) {
    return "TBA";
  }

  if (minutes < 100) {
    return "Short";
  }

  if (minutes <= 140) {
    return "Medium";
  }

  if (minutes <= 180) {
    return "Long";
  }

  return "Epic";
};

const buildWhyReelbotBullets = (movie, previewMode = false) => {
  if (!movie) {
    return [];
  }

  const genres = movie.genre_names || [];
  const bullets = [];

  if (previewMode) {
    bullets.push("The cast, genre mix, and premise already give it a distinct lane.");
    bullets.push(movie.director ? `The director signal gives the movie a clearer identity than a generic preview.` : "The early materials suggest a more specific tone than a generic studio preview.");
    bullets.push("Best treated as an early-read prospect rather than a guaranteed opening-night lock.");
    return bullets;
  }

  if (includesAnyGenre(genres, ["Thriller", "Mystery", "Crime"])) {
    bullets.push("Strong tension and momentum make it easier to commit to than a flatter drama.");
  }

  if (includesAnyGenre(genres, ["Drama", "History", "War"])) {
    bullets.push("It plays best when you want something serious, immersive, and a little more demanding.");
  }

  if (includesAnyGenre(genres, ["Comedy", "Romance", "Animation", "Family"])) {
    bullets.push("Easy to get into without much effort.");
  }

  if (includesAnyGenre(genres, ["Sci-Fi", "Fantasy"])) {
    bullets.push("More personality than a typical background watch.");
  }

  if (Number(movie.runtime || 0) >= 145) {
    bullets.push("It rewards patience more than casual half-attention viewing.");
  } else if (Number(movie.runtime || 0) > 0) {
    bullets.push("A runtime that’s easy to fit in.");
  }

  if (Number(movie.rating || 0) >= 7.3 && Number(movie.vote_count || 0) >= 100) {
    bullets.push("Audience response is strong enough to make this a safer recommendation than a pure wildcard.");
  }

  return bullets.slice(0, 3);
};

const formatReviewMeta = (review, source = "TMDB user reviews") => {
  if (!review) {
    return source;
  }

  const parts = [review.author || source];
  if (typeof review.rating === "number") {
    parts.push(`${review.rating}/10`);
  }
  if (review.updated_at) {
    parts.push(
      new Date(review.updated_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    );
  }

  return parts.filter(Boolean).join(" • ");
};

const formatNextWatchRoleLabel = (value = "") => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue.includes("safer")) {
    return "Safer pick";
  }

  if (normalizedValue.includes("darker")) {
    return "Darker pick";
  }

  if (normalizedValue.includes("wildcard")) {
    return "Wildcard";
  }

  if (normalizedValue.includes("similar")) {
    return "Similar tone";
  }

  return value;
};

function MovieDetails() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const heroRef = useRef(null);
  const reelbotPanelRef = useRef(null);
  const reelbotPulseTimeoutRef = useRef(null);
  const autoOpenedReelbotActionRef = useRef(false);
  const [movie, setMovie] = useState(null);
  const [reelbotResults, setReelbotResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reelbotLoadingAction, setReelbotLoadingAction] = useState(null);
  const [reelbotError, setReelbotError] = useState(null);
  const [activeReelbotAction, setActiveReelbotAction] = useState(null);
  const [panelPulse, setPanelPulse] = useState(false);
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [spoilerModeEnabled, setSpoilerModeEnabled] = useState(false);
  const [showFloatingReelbotCta, setShowFloatingReelbotCta] = useState(false);
  const [floatingReelbotPulse, setFloatingReelbotPulse] = useState(false);
  const { profile, actions: tasteActions, getRecommendationContextForMovie } = useTasteProfile();

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        setLoading(true);
        const movieResponse = await axios.get(`${process.env.REACT_APP_API_URL}/movies/${id}`);
        setMovie(movieResponse.data);

        const expectedSlug = slugifyMovieTitle(movieResponse.data?.title);
        if (expectedSlug && slug !== expectedSlug) {
          navigate(getMoviePath(movieResponse.data), { replace: true });
        }

        setError(null);
      } catch (requestError) {
        console.error("Error fetching movie details:", requestError);
        setError("Failed to load movie details.");
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [id, slug, navigate]);

  useEffect(() => {
    setReelbotResults({});
    setActiveReelbotAction(null);
    setReelbotError(null);
    setReelbotLoadingAction(null);
    setPanelPulse(false);
    setIsTrailerOpen(false);
  }, [id]);

  useEffect(() => {
    if (!movie?.id) {
      return;
    }

    tasteActions.addRecentMovie(movie);
  }, [movie, tasteActions]);

  useEffect(
    () => () => {
      if (reelbotPulseTimeoutRef.current) {
        window.clearTimeout(reelbotPulseTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const heroNode = heroRef.current;
    if (!heroNode || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    let hasPulsed = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextVisible = !entry.isIntersecting;
        setShowFloatingReelbotCta(nextVisible);

        if (nextVisible && !hasPulsed) {
          hasPulsed = true;
          setFloatingReelbotPulse(true);
          window.setTimeout(() => setFloatingReelbotPulse(false), 1800);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(heroNode);
    return () => observer.disconnect();
  }, []);

  const previewMode = useMemo(() => isUpcomingMovie(movie), [movie]);
  const actionConfigs = useMemo(() => getActionConfigMap(previewMode), [previewMode]);
  const primaryActionIds = useMemo(() => DETAIL_PRIMARY_ACTION_IDS, []);
  const secondaryActionIds = useMemo(() => (previewMode ? UPCOMING_SECONDARY_ACTION_IDS : RELEASED_SECONDARY_ACTION_IDS), [previewMode]);
  const spoilerActionIds = useMemo(() => (previewMode ? [] : RELEASED_SPOILER_ACTION_IDS), [previewMode]);
  const spoilerActionSet = useMemo(() => new Set(spoilerActionIds), [spoilerActionIds]);
  const nonSpoilerSecondaryActionIds = useMemo(
    () => secondaryActionIds.filter((actionId) => !spoilerActionSet.has(actionId)),
    [secondaryActionIds, spoilerActionSet]
  );
  const spoilerShortcutIds = useMemo(
    () => spoilerActionIds.filter((actionId) => actionConfigs[actionId]),
    [actionConfigs, spoilerActionIds]
  );

  const metaItems = useMemo(() => {
    if (!movie) {
      return [];
    }

    return [
      movie.runtime ? `${movie.runtime} min` : null,
      movie.release_year ? `${movie.release_year}` : null,
      movie.genre_names?.length ? movie.genre_names.join(" • ") : null,
      !previewMode && movie.rating ? `TMDB ${movie.rating.toFixed(1)}` : null,
      previewMode && movie.status ? movie.status : null,
    ].filter(Boolean);
  }, [movie, previewMode]);

  const movieDescription = movie?.description || movie?.overview || "No description available.";
  const timeCommitment = useMemo(() => getTimeCommitment(movie?.runtime), [movie]);

  const compactFacts = useMemo(() => {
    if (!movie) {
      return [];
    }

    const boxOfficeValue = formatCurrency(movie.revenue || movie.box_office);
    const runtimeValue = movie.runtime ? `${movie.runtime} min` : "Runtime TBA";
    const runtimeFactValue = (
      <>
        <span>{runtimeValue}</span>
        <span className="detail-compact-fact-subvalue">Time Commitment: {timeCommitment}</span>
      </>
    );

    if (previewMode) {
      return [
        { label: "Release Date", value: formatReleaseDate(movie.release_date) },
        { label: "Director", value: movie.director || "TBA" },
        { label: "Lead Cast", value: summarizeList(movie.top_cast, 4) || "TBA" },
        { label: "Runtime", value: runtimeFactValue },
      ];
    }

    return [
      { label: "Director", value: movie.director || "TBA" },
      { label: "Lead Cast", value: summarizeList(movie.top_cast, 4) || "TBA" },
      { label: "Runtime", value: runtimeFactValue },
      { label: boxOfficeValue ? "Box Office" : "Audience Score", value: boxOfficeValue || (movie.rating ? `TMDB ${movie.rating.toFixed(1)}` : "Not enough data") },
    ];
  }, [movie, previewMode, timeCommitment]);

  const recommendationContext = useMemo(() => {
    const storedContext = getRecommendationContextForMovie(movie?.id);

    if (location.state?.source === "reelbot_pick") {
      return {
        ...(storedContext || {}),
        source: "reelbot_pick",
      };
    }

    return storedContext;
  }, [getRecommendationContextForMovie, location.state?.source, movie?.id]);
  const homePickSession = tasteProfileService.loadHomePickSession();
  const hasBackToPick = Boolean(homePickSession?.pickResult?.primary || recommendationContext?.source === "reelbot_pick" || location.state?.source === "reelbot_pick");
  const detailVerdict = useMemo(() => buildDetailVerdict({ movie, recommendationContext }), [movie, recommendationContext]);
  const hiddenMovieIds = useMemo(() => new Set((profile.skipped || []).map((item) => item.id)), [profile]);
  const similarMovies = useMemo(() => (movie?.similar || []).filter((similarMovie) => !hiddenMovieIds.has(similarMovie.id)), [hiddenMovieIds, movie]);
  const nextWatchReasonLabels = previewMode
    ? ["Watch-now pick", "Broader pick", "Wildcard"]
    : ["Similar tone", "Safer pick", "Darker pick", "Wildcard"];
  const displayedSimilarMovies = useMemo(() => similarMovies.slice(0, 3), [similarMovies]);
  const whyReelbotBullets = useMemo(() => {
    const whyWatchReasons = reelbotResults.why_watch?.structured_content?.reasons;
    if (Array.isArray(whyWatchReasons) && whyWatchReasons.length) {
      return whyWatchReasons.map((item) => item.detail).filter(Boolean).slice(0, 3);
    }

    const bestIfBullets = reelbotResults.best_if_you_want?.structured_content?.bullets;
    if (Array.isArray(bestIfBullets) && bestIfBullets.length) {
      return bestIfBullets.slice(0, 3);
    }

    return buildWhyReelbotBullets(movie, previewMode);
  }, [movie, previewMode, reelbotResults]);

  const detailStructuredData = useMemo(() => {
    if (!movie) {
      return [buildBreadcrumbJsonLd([{ name: "Home", path: "/" }])];
    }

    const moviePath = getMoviePath(movie);
    const movieSchema = {
      "@context": "https://schema.org",
      "@type": "Movie",
      name: movie.title,
      description: movieDescription,
      url: buildAbsoluteUrl(moviePath),
      image: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
      datePublished: movie.release_date || undefined,
      genre: movie.genre_names?.length ? movie.genre_names : undefined,
      director: movie.director ? { "@type": "Person", name: movie.director } : undefined,
      actor: Array.isArray(movie.top_cast) ? movie.top_cast.slice(0, 5).map((name) => ({ "@type": "Person", name })) : undefined,
      aggregateRating: movie.vote_count
        ? {
            "@type": "AggregateRating",
            ratingValue: Number(movie.rating || movie.vote_average || 0).toFixed(1),
            ratingCount: movie.vote_count,
            bestRating: 10,
            worstRating: 1,
          }
        : undefined,
    };

    return [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: previewMode ? "Coming Soon" : "Now Playing", path: previewMode ? "/coming-soon" : "/now-playing" },
        { name: movie.title, path: moviePath },
      ]),
      movieSchema,
    ];
  }, [movie, movieDescription, previewMode]);

  usePageMetadata({
    title: movie ? `${movie.title}${movie.release_year ? ` (${movie.release_year})` : ""} — Should You Watch It? | ReelBot` : "Movie Details | ReelBot",
    description: movie ? `Is ${movie.title} worth watching? See the ReelBot verdict, movie tone analysis, streaming options, and similar movies.` : "Movie details on ReelBot.",
    path: movie ? getMoviePath(movie) : "/",
    type: "video.movie",
    image: movie?.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
    structuredData: detailStructuredData,
  });

  useEffect(() => {
    if (!movie?.id) {
      return;
    }

    const canonicalPath = getMoviePath(movie);
    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [location.pathname, movie, navigate]);

  const hasWatchProviders = useMemo(() => {
    const availability = movie?.watch_providers;
    if (!availability) {
      return false;
    }

    return [availability.subscription, availability.rent, availability.buy].some((group) => Array.isArray(group) && group.length > 0);
  }, [movie]);
  const reviewHighlights = movie?.review_highlights || { positive: null, negative: null, count: 0, source: "TMDB user reviews" };
  const showReviewSplit = !previewMode && (reviewHighlights.positive || reviewHighlights.negative);
  const activeReelbotConfig = activeReelbotAction ? actionConfigs[activeReelbotAction] : null;
  const activeReelbotResult = activeReelbotAction ? reelbotResults[activeReelbotAction] : null;
  const followUpActionIds = activeReelbotAction
    ? getFollowUpActionIds(activeReelbotAction, previewMode).filter(
        (actionId) => actionId !== activeReelbotAction && (spoilerModeEnabled || !spoilerActionSet.has(actionId))
      )
    : [];
  const stagedReelbotConfig = activeReelbotConfig || {
    panelTitle: previewMode ? "ReelBot Preview" : "ReelBot Response",
    panelKicker: previewMode ? "Waiting for your pick" : "Waiting for your pick",
    featured: false,
  };
  const isActiveReelbotLoading = Boolean(activeReelbotAction && reelbotLoadingAction === activeReelbotAction);
  const hasExpandedReelbotPanel = Boolean(activeReelbotAction || reelbotError || isActiveReelbotLoading);

  const scrollToReelbotPanel = useCallback(() => {
    const panel = reelbotPanelRef.current;

    if (!panel) {
      return;
    }

    const panelTop = panel.getBoundingClientRect().top + window.scrollY;
    const targetTop = Math.max(panelTop - PANEL_SCROLL_OFFSET, 0);

    window.scrollTo({ top: targetTop, behavior: "smooth" });
  }, []);


  const handleJumpLink = (targetId, event) => {
    event.preventDefault();
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(targetTop - DETAIL_ANCHOR_OFFSET, 0), behavior: "smooth" });
  };

  const handleFloatingReelbotClick = () => {
    const target = document.getElementById("ask-reelbot");
    if (!target) {
      return;
    }

    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(targetTop - DETAIL_ANCHOR_OFFSET, 0), behavior: "smooth" });
  };

  const handleBackToPick = useCallback(() => {
    navigate("/#pick-result", {
      state: {
        restorePickSession: true,
        scrollToPickResult: true,
      },
    });
  }, [navigate]);

  const handleRefinePick = useCallback(() => {
    navigate("/#pick-for-me", {
      state: {
        restorePickSession: true,
        focusPickPrompt: true,
      },
    });
  }, [navigate]);

  const pulseReelbotPanel = useCallback(() => {
    setPanelPulse(false);

    if (reelbotPulseTimeoutRef.current) {
      window.clearTimeout(reelbotPulseTimeoutRef.current);
    }

    requestAnimationFrame(() => {
      setPanelPulse(true);
      reelbotPulseTimeoutRef.current = window.setTimeout(() => {
        setPanelPulse(false);
      }, 1800);
    });
  }, []);

  const buildReelbotRequestPayload = useCallback((actionId) => {
    const spoilerActionSelected = spoilerActionSet.has(actionId);

    return {
      movie_id: Number(id),
      action: actionId,
      trigger: "user_click",
      spoiler_mode: spoilerActionSelected,
      prompt_template: previewMode ? "detail_preview" : spoilerActionSelected ? "detail_spoiler" : "detail_standard",
      use_case: actionId,
      user_prompt: recommendationContext?.prompt || "",
      intent_snapshot: recommendationContext?.intent || undefined,
    };
  }, [id, previewMode, recommendationContext, spoilerActionSet]);

  const handleReelbotAction = useCallback(async (actionId, options = {}) => {
    const action = actionConfigs[actionId];
    const spoilerActionSelected = spoilerActionSet.has(actionId);
    const spoilerModeActive = spoilerModeEnabled || options.enableSpoilerMode;

    if (!action) {
      return;
    }

    if (spoilerActionSelected && !spoilerModeActive) {
      setReelbotError("Turn Spoiler Mode on to unlock spoiler answers.");
      scrollToReelbotPanel();
      return;
    }

    if (spoilerActionSelected && options.enableSpoilerMode && !spoilerModeEnabled) {
      setSpoilerModeEnabled(true);
    }

    setActiveReelbotAction(actionId);
    setReelbotError(null);

    requestAnimationFrame(() => {
      scrollToReelbotPanel();
      pulseReelbotPanel();
    });

    if (reelbotResults[actionId]) {
      return;
    }

    try {
      setReelbotLoadingAction(actionId);
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/movies/${id}/reelbot`,
        buildReelbotRequestPayload(actionId),
        {
          headers: {
            "X-ReelBot-Trigger": "user_click",
          },
        }
      );

      setReelbotResults((previous) => ({ ...previous, [actionId]: response.data }));
    } catch (requestError) {
      console.error("Error fetching ReelBot insight:", requestError);
      const nextError = requestError.response?.data?.error?.message || requestError.response?.data?.error || requestError.response?.data?.message || DEFAULT_REELBOT_ERROR;
      setReelbotError(typeof nextError === "string" ? nextError : DEFAULT_REELBOT_ERROR);
    } finally {
      setReelbotLoadingAction((currentValue) => (currentValue === actionId ? null : currentValue));
    }
  }, [actionConfigs, buildReelbotRequestPayload, id, pulseReelbotPanel, reelbotResults, scrollToReelbotPanel, spoilerActionSet, spoilerModeEnabled]);

  const handleSecondaryReelbotAction = useCallback((actionId) => {
    if (spoilerActionSet.has(actionId)) {
      handleReelbotAction(actionId, { enableSpoilerMode: true });
      return;
    }

    handleReelbotAction(actionId);
  }, [handleReelbotAction, spoilerActionSet]);

  // The detail page should auto-open a requested ReelBot action exactly once when arriving from a card CTA.
  useEffect(() => {
    const requestedAction = location.state?.reelbotAction;

    if (!movie?.id || !requestedAction || autoOpenedReelbotActionRef.current) {
      return;
    }

    autoOpenedReelbotActionRef.current = true;
    handleReelbotAction(requestedAction);
    navigate(location.pathname, { replace: true, state: {} });
  }, [handleReelbotAction, location.pathname, location.state, movie, navigate]);

  if (loading) {
    return (
      <div className="loading-message">
        <span className="status-glyph" aria-hidden="true"></span>
        <span>Loading movie details...</span>
      </div>
    );
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  if (!movie) {
    return <p className="error-message">No data available.</p>;
  }

  return (
    <div className="movie-details-page">
      <div className="movie-details-container detail-shell">
        <nav className="detail-topbar" aria-label="Breadcrumb">
          <div className="detail-breadcrumb">
            <Link to="/" className="detail-breadcrumb-link">
              Home
            </Link>
            <span className="detail-breadcrumb-separator" aria-hidden="true">
              /
            </span>
            <Link to={previewMode ? "/coming-soon" : "/now-playing"} className="detail-breadcrumb-link">
              Browse
            </Link>
            <span className="detail-breadcrumb-separator" aria-hidden="true">
              /
            </span>
            <span className="detail-breadcrumb-current" aria-current="page">
              {movie.title}
            </span>
          </div>
          {hasBackToPick ? (
            <button type="button" className="detail-text-action detail-text-action--hero detail-topbar-return" onClick={handleBackToPick}>
              Back to your pick
            </button>
          ) : null}
        </nav>

        <section
          ref={heroRef}
          className="detail-hero"
          style={
            movie.backdrop_path
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(8, 11, 22, 0.92), rgba(8, 11, 22, 0.78)), url(https://image.tmdb.org/t/p/original${movie.backdrop_path})`,
                }
              : undefined
          }
        >
          <div className="detail-poster-column">
            <img
              src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "/placeholder.jpg"}
              alt={movie.title}
              className="detail-poster"
            />
          </div>

          <div className="detail-content-column">
            <div className="detail-eyebrow">{previewMode ? "Coming Soon" : "Movie Details"}</div>
            <h1 className="movie-title detail-title">{movie.title}</h1>
            {movie.tagline ? <p className="detail-tagline">{movie.tagline}</p> : null}

            <div className="detail-meta-strip">
              {metaItems.map((item) => (
                <span key={item} className="detail-meta-pill">
                  {item}
                </span>
              ))}
            </div>

            <div className="detail-description-block">
              <div className="detail-description-label">Overview</div>
              <p className="detail-description">{movieDescription}</p>
            </div>

            <div className="detail-hero-actions">
              <div className="detail-hero-inline-row detail-hero-inline-row--primary">
                <button type="button" className="detail-trailer-cta" onClick={(event) => handleJumpLink("ask-reelbot", event)}>
                  Is This Worth Watching?
                </button>
                {movie.trailer?.key ? (
                  <button type="button" className="detail-text-action detail-text-action--hero" onClick={() => setIsTrailerOpen(true)}>
                    Watch Trailer
                  </button>
                ) : (
                  <>
                    <button type="button" className="detail-text-action detail-text-action--hero detail-text-action--disabled" disabled>
                      Watch Trailer
                    </button>
                    <span className="detail-trailer-note">Trailer not posted yet.</span>
                  </>
                )}
                {hasWatchProviders ? (
                  <button type="button" className="detail-text-action detail-text-action--hero" onClick={(event) => handleJumpLink("where-to-watch", event)}>
                    See Where to Watch
                  </button>
                ) : null}
                <button type="button" className="detail-text-action detail-text-action--hero" onClick={(event) => handleJumpLink("ask-reelbot", event)}>
                  Get another pick
                </button>
              </div>
              <div className="detail-hero-tracking-actions">
                <TasteActionBar movie={movie} compact className="detail-taste-actions" showVibeAction={false} />
              </div>
            </div>

          </div>
        </section>

        <section className="detail-info-card detail-decision-card detail-anchor-target">
          <div className="detail-decision-head">
            <div>
              {detailVerdict.label ? <div className="detail-description-label">{detailVerdict.label}</div> : null}
              {detailVerdict.contextReference ? <div className="detail-decision-context">{detailVerdict.contextReference}</div> : null}
              <h2 className="detail-decision-title">{detailVerdict.title}</h2>
              <p className="detail-decision-summary">{detailVerdict.supportingLine}</p>
              {detailVerdict.mode === "default" ? (
                <button type="button" className="detail-text-action detail-decision-cta" onClick={(event) => handleJumpLink("ask-reelbot", event)}>
                  Ask ReelBot
                </button>
              ) : null}
            </div>
          </div>

          <div className="detail-decision-snapshot-grid" aria-label="Decision snapshot">
            {detailVerdict.snapshotItems.map((item) => (
              <div key={item.label} className="detail-vibe-item detail-vibe-item--compact">
                <div className="detail-vibe-label">{item.label}</div>
                <div className="detail-vibe-value">{item.value}</div>
              </div>
            ))}
          </div>
        </section>

            <section id="ask-reelbot" className="reelbot-module reelbot-module--streamlined detail-anchor-target">
              <div className="detail-section-head reelbot-module-head">
                <div>
                  <div className="detail-description-label">Ask ReelBot</div>
                  <h2 className="detail-section-title reelbot-module-title">Ask ReelBot</h2>
                  <p className="reelbot-module-copy">
                    {previewMode
                      ? "Ask for a quick early read on who it seems for, how it looks, and what to watch while you wait."
                      : "Quick takes, spoiler answers, and next-watch help in one place."}
                  </p>
                </div>
              </div>

              <div className="reelbot-inline-subsection reelbot-inline-subsection--recovery">
                <p className="reelbot-subsection-copy">Not feeling this? Get another pick →</p>
                <button type="button" className="detail-text-action detail-text-action--hero" onClick={() => handleReelbotAction("similar_picks")}>
                  Get another pick
                </button>
              </div>

              {previewMode ? (
                <div className="reelbot-preview-banner">
                  <div className="detail-description-label">Before release</div>
                  <p className="detail-secondary-text">
                    ReelBot is working from the synopsis, cast, genre, and release details available so far, so treat this as an early read rather than a finished-view verdict.
                  </p>
                </div>
              ) : null}

              <div className="reelbot-primary-row">
                {primaryActionIds.map((actionId) => {
                  const action = actionConfigs[actionId];
                  return (
                    <button
                      key={action.id}
                      type="button"
                      className={`reelbot-primary-action${activeReelbotAction === action.id ? " is-active" : ""}${action.featured ? " is-featured" : ""}`}
                      onClick={() => handleReelbotAction(action.id)}
                      disabled={reelbotLoadingAction === action.id}
                    >
                      <span className="reelbot-primary-action-title">{action.label}</span>
                      <span className="reelbot-primary-action-copy">{action.hint}</span>
                      <span className="reelbot-primary-action-meta">Tap to ask</span>
                    </button>
                  );
                })}
              </div>

              <div className="reelbot-secondary-actions">
                {nonSpoilerSecondaryActionIds.map((actionId) => {
                  const action = actionConfigs[actionId];
                  const isActive = activeReelbotAction === action.id;
                  const isLoading = reelbotLoadingAction === action.id;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      className={`reelbot-secondary-action${isActive ? " is-active" : ""}`}
                      onClick={() => handleSecondaryReelbotAction(action.id)}
                      disabled={isLoading}
                      aria-pressed={isActive}
                      aria-controls="reelbot-response"
                    >
                      {isLoading ? "Thinking..." : action.label}
                    </button>
                  );
                })}
              </div>

              {!previewMode ? (
                <div className={`reelbot-spoiler-panel${spoilerModeEnabled ? " is-enabled" : ""}`}>
                  <div className="reelbot-spoiler-toggle-row">
                    <div className="reelbot-spoiler-copy">
                      <div className="detail-description-label">Spoiler Mode</div>
                      <div className="reelbot-spoiler-state-line">
                        <span className={`reelbot-spoiler-state-pill${spoilerModeEnabled ? " is-enabled" : ""}`}>
                          Spoiler Mode: {spoilerModeEnabled ? "On" : "Off"}
                        </span>
                      </div>
                      <p className="detail-secondary-text">
                        {spoilerModeEnabled
                          ? "Full-spoiler answers are unlocked below, including synopsis, ending, themes, and debate points."
                          : "Spoiler answers stay locked until you turn this on intentionally."}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`reelbot-spoiler-toggle${spoilerModeEnabled ? " is-enabled" : ""}`}
                      onClick={() => setSpoilerModeEnabled((currentValue) => !currentValue)}
                      aria-pressed={spoilerModeEnabled}
                      aria-label={`Turn spoiler mode ${spoilerModeEnabled ? "off" : "on"}`}
                    >
                      <span className="reelbot-spoiler-toggle-track" aria-hidden="true">
                        <span className="reelbot-spoiler-toggle-thumb"></span>
                      </span>
                    </button>
                  </div>

                  {spoilerModeEnabled ? (
                    <div className="reelbot-chip-row">
                      {spoilerShortcutIds.map((actionId) => {
                        const action = actionConfigs[actionId];
                        const isLoading = reelbotLoadingAction === action.id;

                        return (
                          <button
                            key={action.id}
                            type="button"
                            className={`reelbot-question-chip reelbot-question-chip--panel reelbot-question-chip--spoiler${activeReelbotAction === action.id ? " is-active" : ""}`}
                            onClick={() => handleReelbotAction(action.id)}
                            disabled={isLoading}
                            aria-pressed={activeReelbotAction === action.id}
                            aria-controls="reelbot-response"
                          >
                            {isLoading ? "Thinking..." : action.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {hasExpandedReelbotPanel ? (
                <div
                  id="reelbot-response"
                  ref={reelbotPanelRef}
                  className={`reelbot-panel reelbot-panel--stage detail-anchor-target${stagedReelbotConfig.featured ? " is-primary" : ""}${activeReelbotAction ? " is-live" : " is-empty"}${panelPulse ? " is-pulsing" : ""}`}
                  aria-live="polite"
                  aria-busy={isActiveReelbotLoading}
                >
                  {activeReelbotAction ? (
                    <div className="reelbot-panel-top">
                      <div className="reelbot-panel-top-copy">
                        <div className="reelbot-panel-kicker">{stagedReelbotConfig.panelKicker || "ReelBot"}</div>
                        <div className="reelbot-panel-header">{stagedReelbotConfig.panelTitle}</div>
                        <p className="reelbot-panel-caption">
                          {activeReelbotAction === "similar_picks"
                            ? "Nearby picks that match the same tone and energy."
                            : previewMode
                              ? "Your latest answer stays here while you compare a few early reads."
                              : "Your latest answer stays here while you keep comparing angles."}
                        </p>
                      </div>
                      {stagedReelbotConfig.warning ? <span className="reelbot-warning-chip">{stagedReelbotConfig.warning}</span> : null}
                    </div>
                  ) : null}

                  {reelbotError ? (
                    <div className="reelbot-empty-state" role="status">
                      <p className="error-message">{reelbotError}</p>
                      {activeReelbotAction ? (
                        <div className="reelbot-empty-actions">
                          <button type="button" className="reelbot-empty-cta" onClick={() => handleReelbotAction(activeReelbotAction)}>
                            Try again
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : activeReelbotResult ? (
                    <ReelbotStructuredContent action={activeReelbotAction} result={activeReelbotResult} />
                  ) : isActiveReelbotLoading ? (
                    <div className="reelbot-loading-state">
                      <span className="reelbot-loading-dot" aria-hidden="true"></span>
                      <p className="detail-secondary-text reelbot-placeholder-copy">
                        {previewMode ? "ReelBot is sizing it up from the early details..." : "ReelBot is putting that answer together..."}
                      </p>
                    </div>
                  ) : null}

                  {activeReelbotAction ? (
                    <div className="reelbot-panel-footer">
                      <span className="reelbot-panel-footer-label">Keep going</span>
                      <div className="reelbot-chip-row reelbot-chip-row--panel reelbot-chip-row--footer">
                        {followUpActionIds.map((actionId) => {
                          const action = actionConfigs[actionId];
                          return (
                            <button
                              key={action.id}
                              type="button"
                              className={`reelbot-question-chip reelbot-question-chip--panel${!previewMode && spoilerActionIds.includes(action.id) ? " reelbot-question-chip--spoiler" : ""}`}
                              onClick={() => handleReelbotAction(action.id)}
                              disabled={reelbotLoadingAction === action.id}
                              aria-pressed={activeReelbotAction === action.id}
                              aria-controls="reelbot-response"
                            >
                              {reelbotLoadingAction === action.id ? "Thinking..." : action.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  id="reelbot-response"
                  ref={reelbotPanelRef}
                  className="reelbot-compact-launcher detail-anchor-target"
                  aria-live="polite"
                  aria-busy="false"
                >
                  <p className="reelbot-compact-launcher-copy">Quick Take or deeper check?</p>
                  <div className="reelbot-compact-launcher-actions">
                    <button type="button" className="reelbot-empty-cta" onClick={() => handleReelbotAction("quick_take")}>
                      {actionConfigs.quick_take.label}
                    </button>
                    <button type="button" className="reelbot-empty-link" onClick={() => handleReelbotAction("is_this_for_me")}>
                      {actionConfigs.is_this_for_me.label}
                    </button>
                  </div>
                </div>
              )}
            </section>


        <WatchAvailability availability={movie.watch_providers} sectionId="where-to-watch" movie={movie} />

        <section className="detail-info-card detail-info-card--utility detail-info-card--compact-facts">
          <div className="detail-section-head detail-section-head--facts">
            <div>
              <h2 className="detail-section-title">At a Glance</h2>
              <p className="detail-secondary-text">
                {previewMode
                  ? "The release details that matter most right now."
                  : "The details that help you size it up fast."}
              </p>
            </div>
          </div>
          <div className="detail-compact-facts">
            {compactFacts.map((fact) => (
              <div key={fact.label} className="detail-compact-fact">
                <span className="detail-fact-pill-label">{fact.label}</span>
                <span className="detail-compact-fact-value">{fact.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="detail-info-card detail-info-card--why-reelbot">
          <div className="detail-section-head detail-section-head--facts">
            <div>
              <div className="detail-description-label">Why ReelBot recommends this</div>
              <h2 className="detail-section-title">Why This Is Worth Your Time</h2>
              <p className="detail-secondary-text">Clear reasons this works based on your vibe.</p>
            </div>
          </div>
          <ul className="detail-why-reelbot-list">
            {whyReelbotBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>

        {showReviewSplit ? (
          <section className="detail-info-card detail-info-card--split">
            <div className="detail-section-head detail-section-head--facts">
              <div>
                <h2 className="detail-section-title">Viewer Split</h2>
                <p className="detail-secondary-text">A quick look at what viewers respond to most — and what pushes others away.</p>
              </div>
              {reviewHighlights.count ? <div className="results-count">{reviewHighlights.count} reviews</div> : null}
            </div>

            <div className="review-split-grid">
              {reviewHighlights.positive ? (
                <article className="review-split-card review-split-card--positive">
                  <div className="review-split-kicker">What lands</div>
                  <p className="review-split-quote">"{reviewHighlights.positive.content}"</p>
                  <div className="review-split-meta">{formatReviewMeta(reviewHighlights.positive, reviewHighlights.source)}</div>
                </article>
              ) : null}

              {reviewHighlights.negative ? (
                <article className="review-split-card review-split-card--negative">
                  <div className="review-split-kicker">What misses</div>
                  <p className="review-split-quote">"{reviewHighlights.negative.content}"</p>
                  <div className="review-split-meta">{formatReviewMeta(reviewHighlights.negative, reviewHighlights.source)}</div>
                </article>
              ) : null}
            </div>
          </section>
        ) : null}

        {displayedSimilarMovies.length ? (
          <section id="what-to-watch-next" className="detail-info-card detail-anchor-target">
            <div className="detail-section-head">
              <div>
                <h2 className="detail-section-title">{previewMode ? "Watch while you wait" : "Keep the vibe going"}</h2>
                <p className="detail-secondary-text">
                  {previewMode
                    ? "Nearby picks that match the same tone and energy."
                    : "Nearby picks that match the same tone and energy."}
                </p>
              </div>
            </div>

            <div className="similar-grid">
              {displayedSimilarMovies.map((similarMovie, index) => (
                <Link key={similarMovie.id} to={getMoviePath(similarMovie)} className="similar-card">
                  {similarMovie.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w300${similarMovie.poster_path}`}
                      alt={similarMovie.title}
                      className="similar-poster"
                    />
                  ) : (
                    <div className="similar-poster similar-poster-placeholder">Poster unavailable</div>
                  )}
                  <div className="similar-reason-label">{formatNextWatchRoleLabel(nextWatchReasonLabels[index % nextWatchReasonLabels.length])}</div>
                  <div className="similar-title">{similarMovie.title}</div>
                  <div className="similar-year">{similarMovie.release_date ? new Date(similarMovie.release_date).getFullYear() : "TBA"}</div>
                </Link>
              ))}
            </div>

            <div className="detail-reelbot-cta-block detail-reelbot-cta-block--keep-vibe">
              <div className="detail-reelbot-cta-actions detail-reelbot-cta-actions--standalone">
                <button type="button" className="detail-text-action" onClick={handleBackToPick}>
                  Get another pick
                </button>
                <button type="button" className="detail-text-action detail-text-action--hero" onClick={handleRefinePick}>
                  Refine your vibe
                </button>
              </div>
            </div>
          </section>
        ) : null}
        {showFloatingReelbotCta ? (
          <button
            type="button"
            className={`detail-floating-reelbot${floatingReelbotPulse ? " is-pulsing" : ""}`}
            onClick={handleFloatingReelbotClick}
          >
            Ask ReelBot
          </button>
        ) : null}

        <TrailerModal
          isOpen={isTrailerOpen}
          video={movie?.trailer}
          movieTitle={movie?.title}
          onClose={() => setIsTrailerOpen(false)}
        />
      </div>
    </div>
  );
}

export default MovieDetails;
