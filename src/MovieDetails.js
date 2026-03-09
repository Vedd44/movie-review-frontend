import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";

const REELBOT_ACTIONS = {
  quick_take: {
    id: "quick_take",
    label: "Quick Take",
    hint: "Spoiler-light feel, tone, and viewer fit.",
    panelTitle: "Quick Take",
    panelKicker: "Start Here",
    cardKicker: "Start Here",
    cta: "Start with Quick Take",
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
    hint: "Top 5 reasons this could be worth your time.",
    panelTitle: "Top 5 Reasons to Watch",
    panelKicker: "Persuasion Mode",
  },
  spoiler_synopsis: {
    id: "spoiler_synopsis",
    label: "Spoiler Synopsis",
    hint: "Full story beats if you want the whole picture.",
    panelTitle: "Full Spoiler Synopsis",
    panelKicker: "Everything Revealed",
    warning: "Contains spoilers",
  },
  similar_picks: {
    id: "similar_picks",
    label: "Similar Picks",
    hint: "AI-curated next watches and why they fit.",
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

const PRIMARY_ACTION_IDS = ["quick_take", "is_this_for_me", "why_watch", "spoiler_synopsis", "similar_picks"];
const VIEWER_QUESTION_IDS = ["scary_check", "pace_check", "best_mood", "date_night"];
const SPOILER_ACTION_IDS = ["ending_explained", "themes_and_takeaways", "debate_club"];

const includesAnyGenre = (genres, values) => values.some((value) => genres.includes(value));

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
  let weightNote = "Sits somewhere between light entertainment and emotional heaviness.";
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

function MovieDetails() {
  const { id } = useParams();
  const reelbotPanelRef = useRef(null);
  const [movie, setMovie] = useState(null);
  const [reelbotResults, setReelbotResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reelbotLoadingAction, setReelbotLoadingAction] = useState(null);
  const [reelbotError, setReelbotError] = useState(null);
  const [activeReelbotAction, setActiveReelbotAction] = useState(null);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        setLoading(true);
        const movieResponse = await axios.get(`${process.env.REACT_APP_API_URL}/movies/${id}`);
        setMovie(movieResponse.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching movie details:", err);
        setError("Failed to load movie details.");
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [id]);

  useEffect(() => {
    setReelbotResults({});
    setActiveReelbotAction(null);
    setReelbotError(null);
    setReelbotLoadingAction(null);
  }, [id]);

  const metaItems = useMemo(() => {
    if (!movie) {
      return [];
    }

    return [
      movie.runtime ? `${movie.runtime} min` : null,
      movie.release_year ? `${movie.release_year}` : null,
      movie.genre_names?.length ? movie.genre_names.join(" • ") : null,
      movie.rating ? `TMDB ${movie.rating.toFixed(1)}` : null,
    ].filter(Boolean);
  }, [movie]);

  const movieDescription = movie?.description || movie?.overview || "No description available.";

  const facts = useMemo(() => {
    if (!movie) {
      return [];
    }

    return [
      { label: "Director", value: movie.director },
      { label: "Top Cast", value: movie.top_cast?.length ? movie.top_cast.join(", ") : null },
      {
        label: "Spoken Languages",
        value: movie.spoken_languages?.length ? movie.spoken_languages.join(", ") : null,
      },
      {
        label: "Countries",
        value: movie.production_countries?.length ? movie.production_countries.join(", ") : null,
      },
      { label: "Status", value: movie.status },
      { label: "TMDB Votes", value: movie.vote_count ? movie.vote_count.toLocaleString() : null },
    ].filter((item) => item.value);
  }, [movie]);

  const watchFit = useMemo(() => buildWatchFit(movie), [movie]);

  const activeReelbotConfig = activeReelbotAction ? REELBOT_ACTIONS[activeReelbotAction] : null;
  const activeReelbotResult = activeReelbotAction ? reelbotResults[activeReelbotAction] : null;
  const stagedReelbotConfig = activeReelbotConfig || {
    panelTitle: "ReelBot Response",
    panelKicker: "Waiting for your pick",
    featured: false,
  };

  const handleReelbotAction = async (actionId) => {
    setActiveReelbotAction(actionId);
    setReelbotError(null);

    requestAnimationFrame(() => {
      reelbotPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    } catch (err) {
      console.error("Error fetching ReelBot insight:", err);
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

  if (error) return <p className="error-message">{error}</p>;
  if (!movie) return <p className="error-message">No data available.</p>;

  return (
    <div className="movie-details-page">
      <div className="movie-details-container detail-shell">
        <div className="detail-topbar">
          <div className="detail-breadcrumb">ReelBot / Movie</div>
          <div className="detail-topbar-date">{movie.release_date || "Release date unavailable"}</div>
        </div>

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
            <div className="detail-eyebrow">Movie Details</div>
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

            <div className="reelbot-module">
              <div className="reelbot-module-intro">
                <div className="detail-description-label">Ask ReelBot</div>
                <p className="reelbot-module-copy">
                  Start with a fast ReelBot take, then branch into viewer Q&A, spoiler tools, and smarter next-watch guidance. Nothing runs until you click.
                </p>
              </div>

              <section className="detail-watchfit">
                <div className="detail-watchfit-head">
                  <div className="detail-description-label">Watch Fit</div>
                  <p className="detail-secondary-text">A quick viewer-oriented read before you commit the time.</p>
                </div>
                <div className="detail-watchfit-grid">
                  {watchFit.map((item) => (
                    <div key={item.label} className="detail-watchfit-item">
                      <div className="detail-watchfit-label">{item.label}</div>
                      <div className="detail-watchfit-value">{item.value}</div>
                      <div className="detail-watchfit-note">{item.note}</div>
                    </div>
                  ))}
                </div>
              </section>

              <div
                ref={reelbotPanelRef}
                className={`reelbot-panel reelbot-panel--stage${stagedReelbotConfig.featured ? " is-primary" : ""}${activeReelbotAction ? " is-live" : " is-empty"}`}
                aria-live="polite"
              >
                <div className="reelbot-panel-top">
                  <div>
                    <div className="reelbot-panel-kicker">{stagedReelbotConfig.panelKicker || "ReelBot Insight"}</div>
                    <div className="reelbot-panel-header">{stagedReelbotConfig.panelTitle}</div>
                  </div>
                  {stagedReelbotConfig.warning ? (
                    <span className="reelbot-warning-chip">{stagedReelbotConfig.warning}</span>
                  ) : null}
                </div>

                {!activeReelbotAction ? (
                  <div className="reelbot-empty-state">
                    <p className="detail-secondary-text reelbot-placeholder-copy">
                      Pick a core read, tap a quick question, or open the spoiler tools below. The answer will land here and stay cached for this movie.
                    </p>
                  </div>
                ) : reelbotError ? (
                  <p className="error-message">{reelbotError}</p>
                ) : activeReelbotResult ? (
                  <div className="reelbot-body" dangerouslySetInnerHTML={{ __html: activeReelbotResult.content || "" }} />
                ) : reelbotLoadingAction === activeReelbotAction ? (
                  <p className="detail-secondary-text reelbot-placeholder-copy">ReelBot is thinking through this angle…</p>
                ) : null}
              </div>

              <div className="reelbot-subsection">
                <div className="reelbot-subsection-head">
                  <div>
                    <div className="detail-description-label">Core Reads</div>
                    <p className="reelbot-subsection-copy">The broader ReelBot passes for deciding, skipping, or digging deeper.</p>
                  </div>
                </div>
                <div className="reelbot-action-grid">
                  {PRIMARY_ACTION_IDS.map((actionId) => {
                    const action = REELBOT_ACTIONS[actionId];
                    return (
                      <button
                        key={action.id}
                        type="button"
                        className={`reelbot-action-card${activeReelbotAction === action.id ? " is-active" : ""}${action.featured ? " is-primary" : ""}`}
                        onClick={() => handleReelbotAction(action.id)}
                        disabled={reelbotLoadingAction === action.id}
                      >
                        {action.cardKicker ? <span className="reelbot-action-kicker">{action.cardKicker}</span> : null}
                        <span className="reelbot-action-title">{action.label}</span>
                        <span className="reelbot-action-copy">{action.hint}</span>
                        {action.cta ? (
                          <span className="reelbot-action-footer">
                            <span className="reelbot-action-cta">
                              {reelbotLoadingAction === action.id ? "Thinking through it" : action.cta}
                            </span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="reelbot-subsection">
                <div className="reelbot-subsection-head">
                  <div>
                    <div className="detail-description-label">Quick Questions</div>
                    <p className="reelbot-subsection-copy">Short answers for the practical watch-decision stuff people actually ask.</p>
                  </div>
                </div>
                <div className="reelbot-chip-row">
                  {VIEWER_QUESTION_IDS.map((actionId) => {
                    const action = REELBOT_ACTIONS[actionId];
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

              <div className="reelbot-subsection">
                <div className="reelbot-subsection-head">
                  <div>
                    <div className="detail-description-label">Spoiler Corner</div>
                    <p className="reelbot-subsection-copy">For when you want the ending, themes, and post-watch conversation angles.</p>
                  </div>
                </div>
                <div className="reelbot-chip-row reelbot-chip-row--spoilers">
                  {SPOILER_ACTION_IDS.map((actionId) => {
                    const action = REELBOT_ACTIONS[actionId];
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
              </div>
            </div>
          </div>
        </section>

        <section className="detail-info-card">
          <h2 className="detail-section-title">Details at a Glance</h2>
          <div className="detail-facts-grid">
            {facts.map((fact) => (
              <div key={fact.label} className="detail-fact-item">
                <div className="detail-fact-label">{fact.label}</div>
                <div className="detail-fact-value">{fact.value}</div>
              </div>
            ))}
          </div>
        </section>

        {movie.similar?.length ? (
          <section className="detail-info-card">
            <div className="detail-section-head">
              <div>
                <h2 className="detail-section-title">Keep Exploring</h2>
                <p className="detail-secondary-text">
                  TMDB gives the nearby titles. ReelBot Similar Picks adds the more tailored take when you want it.
                </p>
              </div>
              <button type="button" className="detail-text-action" onClick={() => handleReelbotAction("similar_picks")}>
                Ask ReelBot for smarter matches
              </button>
            </div>

            <div className="similar-grid">
              {movie.similar.map((similarMovie) => (
                <Link key={similarMovie.id} to={`/movies/${similarMovie.id}`} className="similar-card">
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
                  <div className="similar-year">
                    {similarMovie.release_date ? new Date(similarMovie.release_date).getFullYear() : "TBA"}
                  </div>
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
