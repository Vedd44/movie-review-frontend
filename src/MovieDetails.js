import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import { getMoviePath, slugifyMovieTitle } from "./discovery";

const REELBOT_ACTIONS = {
  quick_take: {
    id: "quick_take",
    label: "Quick Take",
    hint: "Spoiler-light feel, tone, and viewer fit.",
    panelTitle: "Quick Take",
    panelKicker: "Start Here",
    featured: true,
  },
  is_this_for_me: {
    id: "is_this_for_me",
    label: "Is This For Me?",
    hint: "Audience fit, mood, and who may want to skip.",
    panelTitle: "Is This For Me?",
    panelKicker: "Audience Fit",
  },
  why_watch: {
    id: "why_watch",
    label: "Why Watch It",
    hint: "The strongest case for whether this is worth your time.",
    panelTitle: "Top 5 Reasons to Watch",
    panelKicker: "Worth Your Time?",
  },
  similar_picks: {
    id: "similar_picks",
    label: "Similar Picks",
    hint: "Smarter next-watch guidance than a plain adjacency grid.",
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
    hint: "What the synopsis, talent, and current signals suggest so far.",
    panelTitle: "First Look",
    panelKicker: "Preview Mode",
  },
  is_this_for_me: {
    label: "Who's It For?",
    hint: "Early audience fit based on the current setup, not post-release certainty.",
    panelTitle: "Who's It For?",
    panelKicker: "Audience Read",
  },
  why_watch: {
    label: "Why It's on the Radar",
    hint: "Why this title has attention before it is even out.",
    panelTitle: "Why It's on the Radar",
    panelKicker: "Why It's Buzzing",
  },
  similar_picks: {
    label: "While You Wait",
    hint: "What to watch now if this is already on your radar.",
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
  let attentionNote = "Works best if you can give it some real focus.";
  if (runtime <= 105 || includesAnyGenre(genres, ["Comedy", "Family", "Animation", "Adventure"])) {
    attention = "Easy";
    attentionNote = "Low-friction enough for a lighter commitment night.";
  } else if (runtime >= 145 || includesAnyGenre(genres, ["Drama", "Mystery", "History", "War"])) {
    attention = "Focused";
    attentionNote = "Best when you want to lock in and stay with it.";
  }

  let weight = "Balanced";
  let weightNote = "Sits between breezy comfort and full emotional heaviness.";
  if (includesAnyGenre(genres, ["Comedy", "Family", "Animation", "Romance"])) {
    weight = "Light";
    weightNote = "More breezy, warm, or easygoing than emotionally heavy.";
  } else if (includesAnyGenre(genres, ["Drama", "War", "History", "Crime"])) {
    weight = "Heavy";
    weightNote = "Expect a more serious or emotionally weighty experience.";
  }

  let pace = "Steady";
  let paceNote = "More about rhythm and scene-building than constant spikes.";
  if (includesAnyGenre(genres, ["Action", "Thriller", "Horror", "Adventure"])) {
    pace = "Brisk";
    paceNote = "Likely to move with more momentum or regular tension beats.";
  } else if (runtime >= 150 || includesAnyGenre(genres, ["Drama", "History"])) {
    pace = "Patient";
    paceNote = "More comfortable taking its time than racing ahead.";
  }

  let bestWith = "Solo";
  let bestWithNote = "Feels like a watch you can sit with on your own.";
  if (includesAnyGenre(genres, ["Comedy", "Family", "Animation"])) {
    bestWith = "Group";
    bestWithNote = "Easy to share with a room that wants a collective watch.";
  } else if (includesAnyGenre(genres, ["Romance"])) {
    bestWith = "Pair";
    bestWithNote = "Better suited to a one-on-one watch than a loud group setting.";
  } else if (includesAnyGenre(genres, ["Horror", "Action"])) {
    bestWith = "Friends";
    bestWithNote = "Works well when you want reactions and shared energy in the room.";
  }

  return [
    { label: "Attention", value: attention, note: attentionNote },
    { label: "Emotional Weight", value: weight, note: weightNote },
    { label: "Pace", value: pace, note: paceNote },
    { label: "Best With", value: bestWith, note: bestWithNote },
  ];
};

const buildPreviewSnapshot = (movie) => {
  const releaseValue = formatReleaseDate(movie?.release_date);
  const genrePromise = movie?.genre_names?.length ? movie.genre_names.join(" • ") : "Genre signals are still forming";
  const runtimeValue = movie?.runtime ? `${movie.runtime} min listed` : "Runtime TBA";

  return [
    {
      label: "Release",
      value: releaseValue,
      note: movie?.status ? `Current status: ${movie.status}.` : "Release timing may still move.",
    },
    {
      label: "Talent",
      value: movie?.director ? `${movie.director}` : "Team still emerging",
      note: movie?.top_cast?.length ? `With ${summarizeList(movie.top_cast, 3)}.` : "Cast details are still limited.",
    },
    {
      label: "Genre Promise",
      value: genrePromise,
      note: "This is the strongest current clue for what kind of watch it may become.",
    },
    {
      label: "Scale",
      value: runtimeValue,
      note: "Treat this as preview-stage signal, not a finished-audience verdict.",
    },
  ];
};

const formatReviewMeta = (review, source) => {
  if (!review) {
    return "";
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
  }, [id]);

  useEffect(
    () => () => {
      if (reelbotPulseTimeoutRef.current) {
        window.clearTimeout(reelbotPulseTimeoutRef.current);
      }
    },
    []
  );

  const previewMode = useMemo(() => isUpcomingMovie(movie), [movie]);
  const actionConfigs = useMemo(() => getActionConfigMap(previewMode), [previewMode]);
  const primaryActionIds = previewMode ? UPCOMING_PRIMARY_ACTION_IDS : RELEASED_PRIMARY_ACTION_IDS;
  const viewerQuestionIds = previewMode ? UPCOMING_VIEWER_QUESTION_IDS : RELEASED_VIEWER_QUESTION_IDS;
  const spoilerActionIds = previewMode ? [] : RELEASED_SPOILER_ACTION_IDS;

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

  const compactFacts = useMemo(() => {
    if (!movie) {
      return [];
    }

    return [
      previewMode ? { label: "Release Date", value: formatReleaseDate(movie.release_date) } : null,
      { label: "Director", value: movie.director },
      { label: "Lead Cast", value: summarizeList(movie.top_cast, 4) },
      { label: "Languages", value: summarizeList(movie.spoken_languages, 3) },
      { label: "Made In", value: summarizeList(movie.production_countries, 2) },
      movie.status && movie.status !== "Released" ? { label: "Release Status", value: movie.status } : null,
    ].filter(Boolean);
  }, [movie, previewMode]);

  const insightCards = useMemo(() => (previewMode ? buildPreviewSnapshot(movie) : buildWatchFit(movie)), [movie, previewMode]);
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
            <Link to={previewMode ? "/?view=upcoming" : "/?view=latest"} className="detail-breadcrumb-link">
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
          className="detail-hero"
          style={
            movie.backdrop_path
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(8, 11, 22, 0.96), rgba(8, 11, 22, 0.85)), url(https://image.tmdb.org/t/p/original${movie.backdrop_path})`,
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

            <section className="detail-vibe-strip">
              <div className="detail-watchfit-head detail-watchfit-head--compact">
                <div>
                  <div className="detail-description-label">{previewMode ? "Preview Snapshot" : "Estimated Vibe"}</div>
                  <p className="detail-secondary-text">
                    {previewMode
                      ? "This title is not out yet, so keep the read grounded in confirmed release info, talent, and the current synopsis."
                      : "A quick read on how this movie is likely to play once you hit start."}
                  </p>
                </div>
              </div>
              <div className="detail-vibe-grid">
                {insightCards.map((item) => (
                  <div key={item.label} className="detail-vibe-item">
                    <div className="detail-vibe-label">{item.label}</div>
                    <div className="detail-vibe-value">{item.value}</div>
                    <div className="detail-vibe-note">{item.note}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="reelbot-module reelbot-module--streamlined">
              <div className="reelbot-module-intro">
                <div className="detail-description-label">Ask ReelBot</div>
                <p className="reelbot-module-copy">
                  {previewMode
                    ? "Ask for the clearest early read: who it seems for, how big it looks, and what to watch while you wait."
                    : "Pick a question and ReelBot will give you a quick, practical read without dragging you through the whole plot."}
                </p>
              </div>

              {previewMode ? (
                <div className="reelbot-preview-banner">
                  <div className="detail-description-label">Preview mode</div>
                  <p className="detail-secondary-text">
                    Because this movie is still {movie.status ? movie.status.toLowerCase() : "unreleased"}, ReelBot only uses current synopsis, talent, genre, and release signals.
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
                      <span className="reelbot-primary-action-meta">Tap to ask ReelBot</span>
                    </button>
                  );
                })}
              </div>

              <div
                ref={reelbotPanelRef}
                className={`reelbot-panel reelbot-panel--stage${stagedReelbotConfig.featured ? " is-primary" : ""}${activeReelbotAction ? " is-live" : " is-empty"}${panelPulse ? " is-pulsing" : ""}`}
                aria-live="polite"
              >
                <div className="reelbot-panel-top">
                  <div className="reelbot-panel-top-copy">
                    <div className="reelbot-panel-kicker">{stagedReelbotConfig.panelKicker || "ReelBot Insight"}</div>
                    <div className="reelbot-panel-header">{stagedReelbotConfig.panelTitle}</div>
                    <p className="reelbot-panel-caption">
                      {activeReelbotAction
                        ? previewMode
                          ? "The latest preview read stays pinned here while you compare other pre-release angles."
                          : "The latest answer stays pinned here while you keep asking sharper follow-ups."
                        : previewMode
                          ? "Start with First Look if you want the clearest, honest preview read without pretending the movie is already out."
                          : "Start with Quick Take if you just want the cleanest read on whether this movie fits tonight."}
                    </p>
                  </div>
                  {stagedReelbotConfig.warning ? <span className="reelbot-warning-chip">{stagedReelbotConfig.warning}</span> : null}
                </div>

                {!activeReelbotAction ? (
                  <div className="reelbot-empty-state">
                    <p className="detail-secondary-text reelbot-placeholder-copy">
                      {previewMode
                        ? "Start with First Look for the clearest early read, then jump into audience fit, scale, or while-you-wait picks."
                        : "Start broad with Quick Take, then use the follow-ups when you want a sharper yes-or-no answer."}
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
                  <div className="reelbot-body" dangerouslySetInnerHTML={{ __html: activeReelbotResult.content || "" }} />
                ) : reelbotLoadingAction === activeReelbotAction ? (
                  <div className="reelbot-loading-state">
                    <span className="reelbot-loading-dot" aria-hidden="true"></span>
                    <p className="detail-secondary-text reelbot-placeholder-copy">
                      {previewMode ? "ReelBot is reading the current release signals..." : "ReelBot is thinking through this angle..."}
                    </p>
                  </div>
                ) : null}

                {activeReelbotAction ? (
                  <div className="reelbot-panel-footer">
                    <span className="reelbot-panel-footer-label">Try next</span>
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

              <div className="reelbot-secondary-stack">
                <div className="reelbot-inline-subsection">
                  <div className="detail-description-label">{previewMode ? "Preview Questions" : "Quick Questions"}</div>
                  <p className="reelbot-subsection-copy">{previewMode ? "Tap any question for a grounded preview read." : "Tap any question for a fast follow-up without leaving the page."}</p>
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
                  <details className="reelbot-spoiler-drawer">
                    <summary className="reelbot-spoiler-summary">Spoiler Zone — full plot, ending, and themes</summary>
                    <p className="reelbot-subsection-copy">Open this only if you have seen it already or you actively want the movie unpacked.</p>
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
                  </details>
                ) : null}
              </div>
            </section>
          </div>
        </section>

        {showReviewSplit ? (
          <section className="detail-info-card detail-info-card--split">
            <div className="detail-section-head detail-section-head--facts">
              <div>
                <h2 className="detail-section-title">The Split</h2>
                <p className="detail-secondary-text">A quick read on what lands and what bounces off people, using the strongest high/low swing from TMDB user reviews.</p>
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

        <section className="detail-info-card detail-info-card--compact-facts">
          <div className="detail-section-head detail-section-head--facts">
            <div>
              <h2 className="detail-section-title">Worth Knowing</h2>
              <p className="detail-secondary-text">
                {previewMode
                  ? "Keep this practical: the confirmed release details, team, and scope that actually matter before opening day."
                  : "The key details that help frame the watch at a glance."}
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

        {movie.similar?.length ? (
          <section className="detail-info-card">
            <div className="detail-section-head">
              <div>
                <h2 className="detail-section-title">{previewMode ? "While You Wait" : "What to Watch Next"}</h2>
                <p className="detail-secondary-text">
                  {previewMode
                    ? "These are the nearby titles to use as touchstones while the real movie is still on the way."
                    : "TMDB gives the nearby titles. ReelBot gives the smarter, more intentional match when you want more than adjacency."}
                </p>
              </div>
            </div>

            <div className="next-watch-spotlight">
              <div>
                <div className="detail-description-label">ReelBot route</div>
                <p className="detail-secondary-text">
                  {previewMode
                    ? "Use While You Wait when you want ReelBot to turn hype into an actual watch-now recommendation."
                    : "Use Similar Picks when you want the tailored why behind the next recommendation, not just a neighboring poster wall."}
                </p>
              </div>
              <button type="button" className="detail-text-action" onClick={() => handleReelbotAction("similar_picks")}>
                {previewMode ? "Ask ReelBot what to watch while you wait" : "Ask ReelBot for smarter matches"}
              </button>
            </div>

            <div className="similar-grid">
              {movie.similar.map((similarMovie) => (
                <Link key={similarMovie.id} to={getMoviePath(similarMovie)} className="similar-card">
                  {similarMovie.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w300${similarMovie.poster_path}`}
                      alt={similarMovie.title}
                      className="similar-poster"
                    />
                  ) : (
                    <div className="similar-poster similar-poster-placeholder">No Image</div>
                  )}
                  <div className="similar-title">{similarMovie.title}</div>
                  <div className="similar-year">{similarMovie.release_date ? new Date(similarMovie.release_date).getFullYear() : "TBA"}</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default MovieDetails;
