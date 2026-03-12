import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import TasteActionBar from "./components/TasteActionBar";
import useTasteProfile from "./hooks/useTasteProfile";
import WatchAvailability from "./components/WatchAvailability";
import TrailerModal from "./components/TrailerModal";
import { getMoviePath, slugifyMovieTitle } from "./discovery";
import { buildBreadcrumbJsonLd, usePageMetadata } from "./seo";
import { buildAbsoluteUrl } from "./siteConfig";

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
    panelTitle: "Top 5 Reasons to Watch",
    panelKicker: "Worth Your Time?",
  },
  similar_picks: {
    id: "similar_picks",
    label: "Similar Picks",
    hint: "Better next-watch ideas than a simple lookalike list.",
    panelTitle: "If You Liked This...",
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

const RELEASED_PRIMARY_ACTION_IDS = ["quick_take", "is_this_for_me", "why_watch", "similar_picks"];
const UPCOMING_PRIMARY_ACTION_IDS = ["quick_take", "is_this_for_me", "why_watch", "similar_picks"];
const RELEASED_VIEWER_QUESTION_IDS = ["scary_check", "pace_check", "best_mood", "date_night"];
const UPCOMING_VIEWER_QUESTION_IDS = ["scary_check", "pace_check", "best_mood", "date_night"];
const RELEASED_SPOILER_ACTION_IDS = ["spoiler_synopsis", "ending_explained", "themes_and_takeaways", "debate_club"];
const PANEL_SCROLL_OFFSET = 112;
const DETAIL_ANCHOR_OFFSET = 110;

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

const getJumpLinks = (movie) => {
  const links = [{ id: "ask-reelbot", label: "Ask ReelBot" }];

  if (!isUpcomingMovie(movie)) {
    links.push({ id: "spoilers", label: "Spoilers" });
  }

  if (movie?.watch_providers) {
    links.push({ id: "where-to-watch", label: "Where to Watch" });
  }

  links.push({ id: "what-to-watch-next", label: "What to Watch Next" });
  return links;
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
      quick_take: ["is_this_for_me", "pace_check", "similar_picks"],
      is_this_for_me: ["why_watch", "best_mood", "date_night"],
      why_watch: ["similar_picks", "best_mood", "pace_check"],
      similar_picks: ["quick_take", "is_this_for_me", "best_mood"],
      scary_check: ["quick_take", "is_this_for_me", "why_watch"],
      pace_check: ["quick_take", "best_mood", "similar_picks"],
      best_mood: ["quick_take", "date_night", "similar_picks"],
      date_night: ["is_this_for_me", "best_mood", "why_watch"],
    };

    return previewMap[actionId] || ["quick_take", "is_this_for_me", "similar_picks"];
  }

  const releasedMap = {
    quick_take: ["is_this_for_me", "best_mood", "similar_picks"],
    is_this_for_me: ["why_watch", "best_mood", "date_night"],
    why_watch: ["is_this_for_me", "similar_picks", "pace_check"],
    similar_picks: ["why_watch", "best_mood", "date_night"],
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

const buildWatchFit = (movie) => {
  const genres = movie?.genre_names || [];
  const runtime = movie?.runtime || 0;

  let attention = "Moderate";
  let attentionNote = "Needs a little focus, but not a huge energy investment.";
  if (runtime <= 105 || includesAnyGenre(genres, ["Comedy", "Family", "Animation", "Adventure"])) {
    attention = "Easy";
    attentionNote = "Simple to drop into without much effort.";
  } else if (runtime >= 145 || includesAnyGenre(genres, ["Drama", "Mystery", "History", "War"])) {
    attention = "Focused";
    attentionNote = "Best when you can lock in and stay with it.";
  }

  let weight = "Balanced";
  let weightNote = "Some feeling, but not relentlessly heavy.";
  if (includesAnyGenre(genres, ["Comedy", "Family", "Animation", "Romance"])) {
    weight = "Light";
    weightNote = "Keeps things lighter than a full emotional sink.";
  } else if (includesAnyGenre(genres, ["Drama", "War", "History", "Crime"])) {
    weight = "Heavy";
    weightNote = "Leans more serious or emotionally weighty.";
  }

  let pace = "Steady";
  let paceNote = "Moves with control rather than constant spikes.";
  if (includesAnyGenre(genres, ["Action", "Thriller", "Horror", "Adventure"])) {
    pace = "Brisk";
    paceNote = "Keeps momentum up with regular tension or movement.";
  } else if (runtime >= 150 || includesAnyGenre(genres, ["Drama", "History"])) {
    pace = "Patient";
    paceNote = "Takes its time instead of racing to the next beat.";
  }

  let bestWith = "Solo";
  let bestWithNote = "Easy to sit with on your own.";
  if (includesAnyGenre(genres, ["Comedy", "Family", "Animation"])) {
    bestWith = "Group";
    bestWithNote = "An easy room-friendly watch.";
  } else if (includesAnyGenre(genres, ["Romance"])) {
    bestWith = "Pair";
    bestWithNote = "Plays better one-on-one than with a loud group.";
  } else if (includesAnyGenre(genres, ["Horror", "Action"])) {
    bestWith = "Friends";
    bestWithNote = "Better when shared reactions are part of the fun.";
  }

  return [
    { label: "Attention", value: attention, note: attentionNote, scale: attention === "Easy" ? 32 : attention === "Focused" ? 88 : 58 },
    { label: "Emotional Weight", value: weight, note: weightNote, scale: weight === "Light" ? 28 : weight === "Heavy" ? 84 : 56 },
    { label: "Pace", value: pace, note: paceNote, scale: pace === "Patient" ? 34 : pace === "Brisk" ? 82 : 58 },
    { label: "Best With", value: bestWith, note: bestWithNote, scale: bestWith === "Solo" ? 30 : bestWith === "Pair" ? 52 : bestWith === "Friends" ? 72 : 88 },
  ];
};

const buildPreviewSnapshot = (movie) => {
  const releaseValue = formatReleaseDate(movie?.release_date);
  const genrePromise = movie?.genre_names?.length ? movie.genre_names.join(" • ") : "Genre picture still coming into focus";
  const runtimeValue = movie?.runtime ? `${movie.runtime} min listed` : "Runtime TBA";

  return [
    {
      label: "Release",
      value: releaseValue,
      note: movie?.status ? `Current status: ${movie.status}.` : "Release timing could still shift.",
    },
    {
      label: "Talent",
      value: movie?.director ? `${movie.director}` : "Team still coming into focus",
      note: movie?.top_cast?.length ? `With ${summarizeList(movie.top_cast, 3)}.` : "Cast details are still light.",
    },
    {
      label: "Genre Promise",
      value: genrePromise,
      note: "This is the clearest clue so far about the kind of movie it wants to be.",
    },
    {
      label: "Scale",
      value: runtimeValue,
      note: "Treat this as an early read, not a final verdict.",
    },
  ];
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

const buildDecisionHelper = (movie, previewMode) => {
  if (!movie) {
    return [];
  }

  const genres = Array.isArray(movie.genre_names) ? movie.genre_names : [];
  const genreSet = new Set(genres);
  const runtime = Number(movie.runtime || 0);
  const score = Number(movie.rating || movie.vote_average || 0);
  const timeCommitment = getTimeCommitment(runtime);
  const overview = String(movie.overview || movie.description || "").toLowerCase();
  const vibeCards = buildWatchFit(movie);
  const vibeMap = new Map(vibeCards.map((item) => [item.label, item.value]));
  const attention = vibeMap.get("Attention") || "Moderate";
  const weight = vibeMap.get("Emotional Weight") || "Balanced";
  const pace = vibeMap.get("Pace") || "Steady";
  const bestWith = vibeMap.get("Best With") || "Solo";
  const hasCue = (...patterns) => patterns.some((pattern) => pattern.test(overview));

  const toneBullet = (() => {
    if (hasCue(/heist|robbery|stolen|thief|con job|criminal plan/)) {
      return "A heist-driven story with clear tension";
    }
    if (hasCue(/investigat|detective|missing|disappear|case|clue|murder/)) {
      return "An investigation-driven story with real forward pull";
    }
    if (hasCue(/revenge|avenge|hunt down|payback|retaliat/)) {
      return "A revenge-driven story with a darker edge";
    }
    if (hasCue(/surviv|escape|stranded|trapped|disaster|rescue/)) {
      return "A survival-focused watch with constant pressure";
    }
    if (hasCue(/family|marriage|relationship|couple|mother|father|daughter|son/)) {
      return weight === "Heavy" ? "A relationship-heavy story with emotional weight" : "A character-led story built around relationships";
    }
    if (genreSet.has("Crime") && genreSet.has("Thriller")) {
      return "A tense, character-driven crime story";
    }
    if (genreSet.has("Crime") && genreSet.has("Drama")) {
      return "A serious crime drama with real weight";
    }
    if (genreSet.has("Thriller") || genreSet.has("Mystery")) {
      return "A tense watch with a darker edge";
    }
    if (genreSet.has("Action") && genreSet.has("Adventure")) {
      return "An action-forward watch with clear momentum";
    }
    if (genreSet.has("Sci-Fi") || genreSet.has("Fantasy")) {
      return "A genre watch with a bigger world to sink into";
    }
    if (genreSet.has("Comedy")) {
      return "A lighter watch with an easy comic lane";
    }
    if (genreSet.has("Animation") || genreSet.has("Family")) {
      return "An accessible watch with broad genre appeal";
    }
    if (genreSet.has("Romance")) {
      return "A character-led story with emotional pull";
    }
    if (genreSet.has("Drama")) {
      return weight === "Heavy" ? "A slow-burn character story with emotional weight" : "A character-driven drama with a steady pull";
    }

    return genres.length >= 2
      ? `A ${genres.slice(0, 2).join("-").toLowerCase()} watch with a clear tone`
      : previewMode
        ? "A watch defined more by tone than instant spectacle"
        : "A watch with a clear tone and genre identity";
  })();

  const paceBullet = (() => {
    if (hasCue(/chase|run|race|mission|escape|manhunt|pursuit/)) {
      return "Built around movement and clear momentum";
    }
    if (hasCue(/secret|cover-up|conspiracy|hidden|double life|twist/)) {
      return "Plot turns and reveals reward close attention";
    }
    if (hasCue(/grief|loss|mourning|reckon|memory|past/)) {
      return "A more patient watch shaped by emotion and fallout";
    }
    if (pace === "Brisk" && timeCommitment === "Short") {
      return "Fast pacing with a low time commitment";
    }
    if (pace === "Brisk") {
      return "Fast pacing and clean forward momentum";
    }
    if (pace === "Patient" && attention === "Focused") {
      return "Deliberate pacing that rewards attention";
    }
    if (pace === "Patient") {
      return "A more patient watch that takes its time";
    }
    if (timeCommitment === "Epic" || timeCommitment === "Long") {
      return `A ${timeCommitment.toLowerCase()} watch that asks for real buy-in`;
    }
    if (attention === "Easy") {
      return "Easy to follow without feeling disposable";
    }

    return `A ${timeCommitment.toLowerCase()} watch with steady pacing`;
  })();

  const fitBullet = (() => {
    if (bestWith === "Group" || bestWith === "Friends") {
      return "Best when you want something easy to watch with other people";
    }
    if (bestWith === "Pair") {
      return "A good fit when you want something to watch one-on-one";
    }
    if (score >= 7.8) {
      return "Strong audience response makes it an easier yes";
    }
    if (weight === "Heavy") {
      return "More immersive than casual, with real emotional weight";
    }
    if (attention === "Focused") {
      return "Best when you want to pay attention, not half-watch";
    }
    if (previewMode) {
      return "Best if the premise already sounds like your lane";
    }

    return "A solid pick when you want something with a clear genre lane";
  })();

  return [toneBullet, paceBullet, fitBullet].filter(Boolean).slice(0, 3);
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

function MovieDetails() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const heroRef = useRef(null);
  const reelbotPanelRef = useRef(null);
  const reelbotPulseTimeoutRef = useRef(null);
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
  const { profile, actions: tasteActions } = useTasteProfile();

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
  const primaryActionIds = useMemo(() => (previewMode ? UPCOMING_PRIMARY_ACTION_IDS : RELEASED_PRIMARY_ACTION_IDS), [previewMode]);
  const viewerQuestionIds = useMemo(() => (previewMode ? UPCOMING_VIEWER_QUESTION_IDS : RELEASED_VIEWER_QUESTION_IDS), [previewMode]);
  const spoilerActionIds = useMemo(() => (previewMode ? [] : RELEASED_SPOILER_ACTION_IDS), [previewMode]);

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

  const insightCards = useMemo(() => (previewMode ? buildPreviewSnapshot(movie) : buildWatchFit(movie)), [movie, previewMode]);
  const hiddenMovieIds = useMemo(() => new Set((profile.skipped || []).map((item) => item.id)), [profile]);
  const similarMovies = useMemo(() => (movie?.similar || []).filter((similarMovie) => !hiddenMovieIds.has(similarMovie.id)), [hiddenMovieIds, movie]);
  const decisionHelperBullets = useMemo(() => buildDecisionHelper(movie, previewMode), [movie, previewMode]);
  const nextWatchReasonLabels = previewMode
    ? ["Watch-now parallel", "Broader alternative", "Stranger side path", "Bigger swing"]
    : ["Similar tone", "Safer next pick", "Stranger follow-up", "More action-forward"] ;

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
    title: movie ? `${movie.title}${movie.release_year ? ` (${movie.release_year})` : ""} — AI Movie Guide and Where to Watch | ReelBot` : "Movie Details | ReelBot",
    description: movie ? `See ReelBot’s quick read on ${movie.title}, including vibe, audience fit, streaming availability, and what to watch next.` : "Movie details on ReelBot.",
    path: movie ? getMoviePath(movie) : "/",
    type: "video.movie",
    structuredData: detailStructuredData,
  });

  useEffect(() => {
    if (!spoilerModeEnabled || !activeReelbotAction || !spoilerActionIds.includes(activeReelbotAction)) {
      return;
    }

    setActiveReelbotAction(null);
  }, [activeReelbotAction, spoilerActionIds, spoilerModeEnabled]);
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
    ? getFollowUpActionIds(activeReelbotAction, previewMode).filter((actionId) => actionId !== activeReelbotAction)
    : [];
  const stagedReelbotConfig = activeReelbotConfig || {
    panelTitle: previewMode ? "ReelBot Preview" : "ReelBot Response",
    panelKicker: previewMode ? "Waiting for your pick" : "Waiting for your pick",
    featured: false,
  };

  const scrollToReelbotPanel = () => {
    const panel = reelbotPanelRef.current;

    if (!panel) {
      return;
    }

    const panelTop = panel.getBoundingClientRect().top + window.scrollY;
    const targetTop = Math.max(panelTop - PANEL_SCROLL_OFFSET, 0);

    window.scrollTo({ top: targetTop, behavior: "smooth" });
  };


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

  const pulseReelbotPanel = () => {
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
  };

  const handleReelbotAction = async (actionId) => {
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
        {
          action: actionId,
          trigger: "user_click",
        },
        {
          headers: {
            "X-ReelBot-Trigger": "user_click",
          },
        }
      );

      setReelbotResults((previous) => ({ ...previous, [actionId]: response.data }));
    } catch (requestError) {
      console.error("Error fetching ReelBot insight:", requestError);
      setReelbotError("Failed to load that ReelBot insight.");
    } finally {
      setReelbotLoadingAction(null);
    }
  };

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

            <div className="detail-reelbot-cta-block">
              <div className="detail-description-label">Ask ReelBot about this movie</div>
              <p className="detail-reelbot-cta-copy">Quick takes, spoiler-safe explanations, and next-watch suggestions.</p>
              <div className="detail-reelbot-cta-actions">
                <button type="button" className="detail-text-action detail-text-action--hero" onClick={() => handleReelbotAction("quick_take")}>
                  Quick Take
                </button>
                <button type="button" className="detail-text-action detail-text-action--hero" onClick={() => handleReelbotAction("is_this_for_me")}>
                  Is This For Me?
                </button>
                <button type="button" className="detail-text-action detail-text-action--hero" onClick={() => handleReelbotAction("why_watch")}>
                  Why Watch It
                </button>
              </div>
            </div>

            <div className="detail-decision-helper">
              <div className="detail-description-label">Best if you want</div>
              <ul className="detail-decision-list">
                {decisionHelperBullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>

            <div className="detail-hero-actions">
              <div className="detail-hero-inline-row detail-hero-inline-row--primary">
                {movie.trailer?.key ? (
                  <button type="button" className="detail-trailer-cta" onClick={() => setIsTrailerOpen(true)}>
                    Watch Trailer
                  </button>
                ) : (
                  <>
                    <button type="button" className="detail-trailer-cta detail-trailer-cta--placeholder" disabled>
                      Watch Trailer
                    </button>
                    <span className="detail-trailer-note">Trailer not posted yet.</span>
                  </>
                )}
                {hasWatchProviders ? (
                  <button type="button" className="detail-text-action detail-text-action--hero" onClick={(event) => handleJumpLink("where-to-watch", event)}>
                    See where to watch
                  </button>
                ) : null}
              </div>
              <div className="detail-hero-tracking-actions">
                <TasteActionBar movie={movie} compact className="detail-taste-actions" showVibeAction={false} />
              </div>
            </div>

            <div className="detail-jump-links-wrap">
              <p className="detail-jump-links-copy">Use ReelBot, spoilers, streaming, or next-watch shortcuts without hunting through the page.</p>
              <div className="detail-jump-links" role="navigation" aria-label="Jump to detail sections">
                {getJumpLinks(movie).map((link) => (
                  <a key={link.id} href={`#${link.id}`} className="detail-jump-link" onClick={(event) => handleJumpLink(link.id, event)}>
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <section className="detail-vibe-strip detail-anchor-target">
              <div className="detail-watchfit-head detail-watchfit-head--compact">
                <div>
                  <div className="detail-description-label">{previewMode ? "Preview Snapshot" : "Estimated Vibe"}</div>
                  <p className="detail-secondary-text">
                    {previewMode
                      ? "A quick early read based on the synopsis, cast, and release details so far."
                      : "ReelBot's quick read on attention, emotional weight, pace, and who this tends to play best with."}
                  </p>
                </div>
              </div>
              <div className="detail-vibe-grid">
                {insightCards.map((item) => (
                  <div key={item.label} className="detail-vibe-item">
                    <div className="detail-vibe-label">{item.label}</div>
                    <div className="detail-vibe-value-row">
                      <div className="detail-vibe-value">{item.value}</div>
                      {typeof item.scale === "number" ? <span className="detail-vibe-meter-label">Quick read</span> : null}
                    </div>
                    {typeof item.scale === "number" ? (
                      <div className="detail-vibe-scale" aria-hidden="true">
                        <span className="detail-vibe-scale-fill" style={{ width: `${item.scale}%` }} />
                      </div>
                    ) : null}
                    <div className="detail-vibe-note">{item.note}</div>
                  </div>
                ))}
              </div>
            </section>

            <section id="ask-reelbot" className="reelbot-module reelbot-module--streamlined detail-anchor-target">
              <div className="detail-section-head reelbot-module-head">
                <div>
                  <div className="detail-description-label">Ask ReelBot</div>
                  <h2 className="detail-section-title reelbot-module-title">Ask ReelBot About This Movie</h2>
                  <p className="reelbot-module-copy">
                    {previewMode
                      ? "Ask for a quick early read on who it seems for, how it looks, and what to watch while you wait."
                      : "Quick takes, spoiler-safe explanations, and smarter next-watch help in one place."}
                  </p>
                </div>
              </div>

              {previewMode ? (
                <div className="reelbot-preview-banner">
                  <div className="detail-description-label">Before release</div>
                  <p className="detail-secondary-text">
                    This one is still {movie.status ? movie.status.toLowerCase() : "unreleased"}, so ReelBot is reading from the synopsis, cast, genre, and release details available so far.
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

              <div className="reelbot-secondary-stack">
                <div className="reelbot-inline-subsection">
                  <div className="detail-description-label">{previewMode ? "Quick Questions" : "Quick Questions"}</div>
                  <p className="reelbot-subsection-copy">{previewMode ? "Tap a question for a quick, spoiler-free preview read." : "Use these when you want a faster yes-or-no angle."}</p>
                  <div className="reelbot-chip-row">
                    {viewerQuestionIds.map((actionId) => {
                      const action = actionConfigs[actionId];
                      return (
                        <button
                          key={action.id}
                          type="button"
                          className={`reelbot-question-chip${activeReelbotAction === action.id ? " is-active" : ""}`}
                          onClick={() => handleReelbotAction(action.id)}
                          disabled={reelbotLoadingAction === action.id}
                        >
                          {reelbotLoadingAction === action.id ? "Thinking..." : action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!previewMode ? (
                  <section id="spoilers" className={`reelbot-spoiler-panel detail-anchor-target${spoilerModeEnabled ? " is-enabled" : ""}`}>
                    <div className="reelbot-spoiler-toggle-row">
                      <div>
                        <div className="detail-description-label">Spoiler Mode: {spoilerModeEnabled ? "ON" : "OFF"}</div>
                        <p className="reelbot-subsection-copy">Turn this on if you want plot, ending, and theme answers in full.</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={spoilerModeEnabled}
                        className={`reelbot-spoiler-toggle${spoilerModeEnabled ? " is-enabled" : ""}`}
                        onClick={() => setSpoilerModeEnabled((currentValue) => !currentValue)}
                      >
                        <span className="reelbot-spoiler-toggle-track">
                          <span className="reelbot-spoiler-toggle-thumb" />
                        </span>
                      </button>
                    </div>
                    {spoilerModeEnabled ? (
                      <div className="reelbot-chip-row reelbot-chip-row--spoilers">
                        {spoilerActionIds.map((actionId) => {
                          const action = actionConfigs[actionId];
                          return (
                            <button
                              key={action.id}
                              type="button"
                              className={`reelbot-question-chip reelbot-question-chip--spoiler${activeReelbotAction === action.id ? " is-active" : ""}`}
                              onClick={() => handleReelbotAction(action.id)}
                              disabled={reelbotLoadingAction === action.id}
                            >
                              {reelbotLoadingAction === action.id ? "Thinking..." : action.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>

              <div
                ref={reelbotPanelRef}
                className={`reelbot-panel reelbot-panel--stage detail-anchor-target${stagedReelbotConfig.featured ? " is-primary" : ""}${activeReelbotAction ? " is-live" : " is-empty"}${panelPulse ? " is-pulsing" : ""}`}
                aria-live="polite"
              >
                <div className="reelbot-panel-top">
                  <div className="reelbot-panel-top-copy">
                    <div className="reelbot-panel-kicker">{stagedReelbotConfig.panelKicker || "ReelBot Insight"}</div>
                    <div className="reelbot-panel-header">{stagedReelbotConfig.panelTitle}</div>
                    <p className="reelbot-panel-caption">
                      {activeReelbotAction
                        ? previewMode
                          ? "Your latest answer stays here while you compare a few early reads."
                          : "Your latest answer stays here while you keep comparing angles."
                        : previewMode
                          ? "Start with First Look for the quickest spoiler-free read on what it seems like so far."
                          : "Start with Quick Take for the fastest read on whether this fits what you want."}
                    </p>
                  </div>
                  {stagedReelbotConfig.warning ? <span className="reelbot-warning-chip">{stagedReelbotConfig.warning}</span> : null}
                </div>

                {!activeReelbotAction ? (
                  <div className="reelbot-empty-state">
                    <p className="detail-secondary-text reelbot-placeholder-copy">
                      {previewMode
                        ? "Start with First Look, then jump into audience fit, scale, or what to watch while you wait."
                        : "Start with Quick Take, then use the follow-ups when you want a sharper yes-or-no answer."}
                    </p>
                    <div className="reelbot-empty-actions">
                      <button type="button" className="reelbot-empty-cta" onClick={() => handleReelbotAction("quick_take")}>
                        {actionConfigs.quick_take.label}
                      </button>
                      <button type="button" className="reelbot-empty-link" onClick={() => handleReelbotAction("is_this_for_me")}>
                        {actionConfigs.is_this_for_me.label}
                      </button>
                    </div>
                  </div>
                ) : reelbotError ? (
                  <p className="error-message">{reelbotError}</p>
                ) : activeReelbotResult ? (
                  <div className={`reelbot-body${activeReelbotAction === "similar_picks" ? " reelbot-body--recommendations" : ""}`} dangerouslySetInnerHTML={{ __html: activeReelbotResult.content || "" }} />
                ) : reelbotLoadingAction === activeReelbotAction ? (
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
                          >
                            {reelbotLoadingAction === action.id ? "Thinking..." : action.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </section>

        <section className="detail-info-card detail-info-card--compact-facts">
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

        <WatchAvailability availability={movie.watch_providers} sectionId="where-to-watch" />

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

        {similarMovies.length ? (
          <section id="what-to-watch-next" className="detail-info-card detail-anchor-target">
            <div className="detail-section-head detail-section-head--with-count">
              <div>
                <h2 className="detail-section-title">{previewMode ? "Watch While You Wait" : "What to Watch Next"}</h2>
                <p className="detail-secondary-text">
                  {previewMode
                    ? "Good watch-now options while the real movie is still on the way."
                    : "Picked for similar tone, energy, or audience appeal — not just title adjacency."}
                </p>
              </div>
              <div className="results-count">{similarMovies.length} titles</div>
            </div>

            <div className="next-watch-spotlight">
              <div>
                <div className="detail-description-label">Want a smarter next pick?</div>
                <p className="detail-secondary-text">
                  {previewMode
                    ? "Ask ReelBot to recommend what to watch now based on tone, pacing, and audience appeal."
                    : "Ask ReelBot to recommend what to watch next based on tone, pacing, and audience appeal."}
                </p>
              </div>
              <button type="button" className="detail-text-action" onClick={() => handleReelbotAction("similar_picks")}>
                {previewMode ? "Ask ReelBot what to watch while you wait" : "Ask ReelBot for a tailored next pick"}
              </button>
            </div>

            <div className="similar-grid">
              {similarMovies.map((similarMovie, index) => (
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
                  <div className="similar-reason-label">{nextWatchReasonLabels[index % nextWatchReasonLabels.length]}</div>
                  <div className="similar-title">{similarMovie.title}</div>
                  <div className="similar-year">{similarMovie.release_date ? new Date(similarMovie.release_date).getFullYear() : "TBA"}</div>
                </Link>
              ))}
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
