import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";

const REELBOT_ACTIONS = [
  {
    id: "quick_take",
    label: "Quick Take",
    hint: "Spoiler-light feel, tone, and viewer fit.",
    panelTitle: "Quick Take",
    panelKicker: "Start Here",
    cardKicker: "Start Here",
    cta: "Start with Quick Take",
    featured: true,
  },
  {
    id: "is_this_for_me",
    label: "Is This For Me?",
    hint: "Audience fit, mood, and who may want to skip.",
    panelTitle: "Is This For Me?",
    panelKicker: "Audience Fit",
  },
  {
    id: "why_watch",
    label: "Why Watch It",
    hint: "Top 5 reasons this could be worth your time.",
    panelTitle: "Top 5 Reasons to Watch",
    panelKicker: "Persuasion Mode",
  },
  {
    id: "spoiler_synopsis",
    label: "Spoiler Synopsis",
    hint: "Full story beats if you want the whole picture.",
    panelTitle: "Full Spoiler Synopsis",
    panelKicker: "Everything Revealed",
    warning: "Contains spoilers",
  },
  {
    id: "similar_picks",
    label: "Similar Picks",
    hint: "AI-curated next watches and why they fit.",
    panelTitle: "If You Liked This...",
    panelKicker: "What To Watch Next",
  },
];

function MovieDetails() {
  const { id } = useParams();
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
      { label: "Status", value: movie.status },
      { label: "Original Language", value: movie.original_language?.toUpperCase() },
      {
        label: "Countries",
        value: movie.production_countries?.length ? movie.production_countries.join(", ") : null,
      },
    ].filter((item) => item.value);
  }, [movie]);

  const activeReelbotConfig = useMemo(
    () => REELBOT_ACTIONS.find((action) => action.id === activeReelbotAction) || null,
    [activeReelbotAction]
  );

  const activeReelbotResult = activeReelbotAction ? reelbotResults[activeReelbotAction] : null;

  const handleReelbotAction = async (actionId) => {
    setActiveReelbotAction(actionId);
    setReelbotError(null);

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
                <span key={item} className="detail-meta-pill">{item}</span>
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
                  Start with a fast ReelBot take, then branch into audience fit, persuasive reasons to watch,
                  spoilers, or smarter next-watch guidance. Nothing runs until you click.
                </p>
              </div>

              <div className="reelbot-action-grid">
                {REELBOT_ACTIONS.map((action) => (
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
                ))}
              </div>

              {activeReelbotConfig ? (
                <div className={`reelbot-panel${activeReelbotConfig.featured ? " is-primary" : ""}`}>
                  <div className="reelbot-panel-top">
                    <div>
                      <div className="reelbot-panel-kicker">{activeReelbotConfig.panelKicker || "ReelBot Insight"}</div>
                      <div className="reelbot-panel-header">{activeReelbotConfig.panelTitle}</div>
                    </div>
                    {activeReelbotConfig.warning ? (
                      <span className="reelbot-warning-chip">{activeReelbotConfig.warning}</span>
                    ) : null}
                  </div>

                  {reelbotError ? (
                    <p className="error-message">{reelbotError}</p>
                  ) : activeReelbotResult ? (
                    <div className="reelbot-body" dangerouslySetInnerHTML={{ __html: activeReelbotResult.content || "" }} />
                  ) : reelbotLoadingAction === activeReelbotAction ? (
                    <p className="detail-secondary-text">ReelBot is thinking through this angle…</p>
                  ) : null}
                </div>
              ) : null}
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
            <h2 className="detail-section-title">More Like This</h2>
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
