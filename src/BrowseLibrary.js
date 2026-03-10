import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import {
  API_BASE_URL,
  DISCOVERY_PROMPTS,
  MOOD_FILTERS,
  PICK_RUNTIME_OPTIONS,
  VALID_VIEWS,
  VIEW_OPTIONS,
  formatMovieDate,
  getMoviePath,
  getReleaseYear,
  getViewLabel,
} from "./discovery";

const LIBRARY_PROMPTS = [...DISCOVERY_PROMPTS, "Popular sci-fi with real payoff", "A punchy action movie with a real star"];

function BrowseLibrary() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const normalizedView = VALID_VIEWS.has(searchParams.get("view")) ? searchParams.get("view") : "popular";
  const normalizedMood = MOOD_FILTERS.some((filter) => filter.id === searchParams.get("mood")) ? searchParams.get("mood") : "all";
  const normalizedRuntime = PICK_RUNTIME_OPTIONS.some((option) => option.id === searchParams.get("runtime"))
    ? searchParams.get("runtime")
    : "any";
  const normalizedPage = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const normalizedGenre = searchParams.get("genre") || "all";

  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genreLoading, setGenreLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [pickPrompt, setPickPrompt] = useState("");
  const [pickLoading, setPickLoading] = useState(false);
  const [pickError, setPickError] = useState(null);
  const [pickResult, setPickResult] = useState(null);

  useEffect(() => {
    setGenreLoading(true);
    axios
      .get(`${API_BASE_URL}/genres`)
      .then((response) => {
        setGenres(response.data.genres || []);
      })
      .catch((requestError) => {
        console.error("Error fetching genres:", requestError);
        setGenres([]);
      })
      .finally(() => {
        setGenreLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const targetId = location.hash.replace("#", "");
    if (!targetId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 90);

    return () => window.clearTimeout(timeoutId);
  }, [location.hash, loading, normalizedGenre, normalizedMood, normalizedRuntime, normalizedView]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const genreQuery = normalizedGenre !== "all" ? `&genre=${encodeURIComponent(normalizedGenre)}` : "";
    const runtimeQuery = normalizedRuntime !== "any" ? `&runtime=${encodeURIComponent(normalizedRuntime)}` : "";

    axios
      .get(`${API_BASE_URL}/movies?type=${normalizedView}&page=${normalizedPage}${genreQuery}${runtimeQuery}`)
      .then((response) => {
        setMovies(response.data.results || []);
        setTotalPages(response.data.total_pages || 1);
      })
      .catch((requestError) => {
        console.error("Error fetching browse library movies:", requestError);
        setError("Failed to fetch browse library movies.");
        setMovies([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [normalizedGenre, normalizedPage, normalizedRuntime, normalizedView]);

  useEffect(() => {
    setPickError(null);
    setPickResult(null);
  }, [normalizedGenre, normalizedMood, normalizedRuntime, normalizedView, pickPrompt]);

  const selectedMoodConfig = useMemo(
    () => MOOD_FILTERS.find((filter) => filter.id === normalizedMood) || MOOD_FILTERS[0],
    [normalizedMood]
  );

  const selectedGenreLabel = useMemo(
    () => genres.find((genre) => String(genre.id) === normalizedGenre)?.name || "All genres",
    [genres, normalizedGenre]
  );

  const filteredMovies = useMemo(
    () => movies.filter((movie) => selectedMoodConfig.predicate(movie)),
    [movies, selectedMoodConfig]
  );

  const updateFilters = (updates) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all" || value === "any") {
        nextParams.delete(key);
      } else {
        nextParams.set(key, String(value));
      }
    });

    if (!Object.prototype.hasOwnProperty.call(updates, "page")) {
      nextParams.set("page", "1");
    }

    if (!nextParams.get("view")) {
      nextParams.set("view", normalizedView);
    }

    setSearchParams(nextParams);
  };

  const handleLibraryPick = async () => {
    try {
      setPickLoading(true);
      setPickError(null);

      const response = await axios.post(
        `${API_BASE_URL}/reelbot/pick`,
        {
          view: normalizedView,
          mood: normalizedMood,
          runtime: normalizedRuntime,
          source: "library",
          company: "any",
          prompt: pickPrompt,
          genre: normalizedGenre,
          trigger: "user_click",
        },
        {
          headers: {
            "X-ReelBot-Trigger": "user_click",
          },
        }
      );

      setPickResult(response.data);
    } catch (requestError) {
      console.error("Error fetching browse ReelBot pick:", requestError);
      setPickError("ReelBot could not pull a library pick right now.");
    } finally {
      setPickLoading(false);
    }
  };

  return (
    <div className="browse-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo">
          <div className="browse-copy">
            <div className="browse-kicker">Browse Library</div>
            <h1 className="browse-title">Filter the catalog with intent</h1>
            <p className="browse-subtitle browse-subtitle--hero">
              Move past one-size-fits-all feeds. Popular reaches deeper across the catalog, while Latest and Coming Soon keep you current. Add genre, runtime, and mood when you want a more intentional lane.
            </p>
          </div>
        </section>

        <section id="library-filters" className="library-filters-card">
          <div className="section-header section-header--stacked-mobile section-header--compact">
            <div>
              <h2 className="section-title">Browse your way</h2>
              <p className="section-subtitle">Use the broad filters first, then tighten the mood if you want a more specific kind of night.</p>
            </div>
            <div className="results-count">{getViewLabel(normalizedView)}</div>
          </div>

          <div className="tabs browse-tabs browse-tabs--library">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={normalizedView === option.id ? "active" : ""}
                onClick={() => updateFilters({ view: option.id })}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="filter-group-stack">
            <div className="filter-group-row">
              <div className="filter-group-head">
                <div className="detail-description-label">Genre</div>
                <p className="detail-secondary-text">Switch from broad browsing into a real library view.</p>
              </div>
              <div className="mood-chip-row">
                <button
                  type="button"
                  className={`mood-rail-chip${normalizedGenre === "all" ? " is-active" : ""}`}
                  onClick={() => updateFilters({ genre: "all" })}
                >
                  <span className="mood-rail-chip-label">All genres</span>
                </button>
                {genres.map((genre) => (
                  <button
                    key={genre.id}
                    type="button"
                    className={`mood-rail-chip${normalizedGenre === String(genre.id) ? " is-active" : ""}`}
                    onClick={() => updateFilters({ genre: genre.id })}
                    disabled={genreLoading}
                  >
                    <span className="mood-rail-chip-label">{genre.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group-row">
              <div className="filter-group-head">
                <div className="detail-description-label">Runtime</div>
                <p className="detail-secondary-text">Useful when the deciding factor is how much night you actually have.</p>
              </div>
              <div className="mood-chip-row">
                {PICK_RUNTIME_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`mood-rail-chip${normalizedRuntime === option.id ? " is-active" : ""}`}
                    onClick={() => updateFilters({ runtime: option.id })}
                  >
                    <span className="mood-rail-chip-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group-row">
              <div className="filter-group-head">
                <div className="detail-description-label">Mood filter</div>
                <p className="detail-secondary-text">Use mood as the last layer so the library does not get over-filtered too early.</p>
              </div>
              <div className="mood-chip-row">
                {MOOD_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={`mood-rail-chip${normalizedMood === filter.id ? " is-active" : ""}`}
                    onClick={() => updateFilters({ mood: filter.id })}
                  >
                    <span className="mood-rail-chip-label">{filter.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="pick-for-me-card library-reelbot-card">
          <div className="section-header section-header--stacked-mobile section-header--compact">
            <div>
              <h2 className="section-title">Ask ReelBot</h2>
              <p className="section-subtitle">Use your current library filters, then add a vibe, actor, or tie-breaker cue when you want ReelBot to narrow it down.</p>
            </div>
            <a href="#library-filters" className="browse-library-link browse-library-link--header">
              Back to filters
            </a>
          </div>

          <div className="pick-control-group pick-control-group--prompt">
            <div className="detail-description-label">Vibe or cue</div>
            <div className="pick-prompt-suggestions">
              {LIBRARY_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" className="mood-rail-chip pick-prompt-chip" onClick={() => setPickPrompt(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
            <div className="pick-prompt-shell">
              <input
                type="text"
                className="pick-prompt-input"
                placeholder="Try: smart sci-fi under 2 hours, a strong date-night pick, dark but rewarding..."
                value={pickPrompt}
                onChange={(event) => setPickPrompt(event.target.value)}
              />
            </div>
            <p className="pick-control-note">ReelBot keeps the current view, genre, runtime, and mood filters in play before it interprets your prompt.</p>
          </div>

          <div className="pick-for-me-actions">
            <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={handleLibraryPick} disabled={pickLoading}>
              {pickLoading ? "ReelBot is picking..." : "Ask ReelBot"}
            </button>
          </div>

          <div className={`pick-result-stage${pickResult?.primary ? " is-live" : ""}${!pickResult?.primary && !pickLoading ? " pick-result-stage--empty" : ""}`}>
            {pickError ? <p className="error-message">{pickError}</p> : null}

            {!pickError && pickLoading ? (
              <div className="reelbot-loading-state">
                <span className="reelbot-loading-dot" aria-hidden="true"></span>
                <p className="detail-secondary-text reelbot-placeholder-copy">ReelBot is reading the library filters and tightening the best-fit lane...</p>
              </div>
            ) : null}

            {!pickError && !pickLoading && pickResult?.primary ? (
              <>
                <div className="pick-result-copy">
                  <div className="detail-description-label">Library match</div>
                  <p className="detail-secondary-text">{pickResult.summary}</p>
                </div>

                <article className="pick-primary-card">
                  <Link to={getMoviePath(pickResult.primary)} className="pick-primary-poster-link">
                    {pickResult.primary.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w300${pickResult.primary.poster_path}`}
                        alt={pickResult.primary.title}
                        className="pick-primary-poster"
                      />
                    ) : (
                      <div className="pick-primary-poster pick-primary-poster--placeholder">No Image</div>
                    )}
                  </Link>
                  <div className="pick-primary-content">
                    <div className="movie-card-meta">
                      <span className="movie-card-chip">{getReleaseYear(pickResult.primary.release_date)}</span>
                      {pickResult.primary.vote_average ? (
                        <span className="movie-card-chip">TMDB {pickResult.primary.vote_average.toFixed(1)}</span>
                      ) : null}
                    </div>
                    <h3 className="pick-primary-title">
                      <Link to={getMoviePath(pickResult.primary)} className="movie-title-link">
                        {pickResult.primary.title}
                      </Link>
                    </h3>
                    <p className="pick-primary-reason">{pickResult.primary.reason}</p>
                    <p className="pick-primary-overview">{pickResult.primary.overview}</p>
                    <Link to={getMoviePath(pickResult.primary)} className="card-link">
                      Open this pick
                    </Link>
                  </div>
                </article>

                {pickResult.alternates?.length ? (
                  <div className="pick-alternates-grid">
                    {pickResult.alternates.map((movie) => (
                      <article key={movie.id} className="pick-alternate-card">
                        <div className="pick-alternate-head">
                          <h3 className="pick-alternate-title">
                            <Link to={getMoviePath(movie)} className="movie-title-link">
                              {movie.title}
                            </Link>
                          </h3>
                          <span className="movie-card-chip">{movie.vote_average ? `TMDB ${movie.vote_average.toFixed(1)}` : getReleaseYear(movie.release_date)}</span>
                        </div>
                        <p className="pick-alternate-reason">{movie.reason}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}

            {!pickError && !pickLoading && !pickResult?.primary ? (
              <div className="pick-empty-state-soft">
                <p className="pick-empty-note detail-secondary-text">Add a vibe if you want, or just ask ReelBot to break the tie using the active library filters.</p>
              </div>
            ) : null}
          </div>
        </section>

        <div id="library-results" className="section-header section-header--stacked-mobile">
          <div>
            <h2 className="section-title">Library Results</h2>
            <p className="section-subtitle">
              {selectedGenreLabel} • {selectedMoodConfig.label} • {PICK_RUNTIME_OPTIONS.find((option) => option.id === normalizedRuntime)?.label || "Any length"}
            </p>
          </div>
          <div className="mood-rail-actions">
            <a href="#library-filters" className="browse-library-link browse-library-link--header">
              Back to filters
            </a>
            <div className="results-count">{filteredMovies.length} titles</div>
          </div>
        </div>

        {loading && (
          <div className="loading-message">
            <span className="status-glyph" aria-hidden="true"></span>
            <span>Loading library results...</span>
          </div>
        )}
        {error && <p className="error-message">{error}</p>}

        {!loading && !error && (
          <div className="movie-list">
            {filteredMovies.length > 0 ? (
              filteredMovies.map((movie) => (
                <article key={movie.id} className="movie-card">
                  <Link to={getMoviePath(movie)} className="movie-poster-link" aria-label={`Open ${movie.title}`}>
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                        alt={movie.title}
                        className="movie-poster"
                      />
                    ) : (
                      <div className="no-poster">No Image Available</div>
                    )}
                  </Link>

                  <div className="movie-card-content">
                    <div className="movie-card-meta">
                      <span className="movie-card-chip">{getReleaseYear(movie.release_date)}</span>
                      {movie.vote_average ? <span className="movie-card-chip">TMDB {movie.vote_average.toFixed(1)}</span> : null}
                    </div>

                    <h3 className="movie-card-title">
                      <Link to={getMoviePath(movie)} className="movie-title-link">
                        {movie.title}
                      </Link>
                    </h3>
                    <p className="movie-card-date">{formatMovieDate(movie.release_date)}</p>

                    <Link to={getMoviePath(movie)} className="card-link">
                      View Details
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <span className="status-glyph" aria-hidden="true"></span>
                <span>That filter stack is too tight right now. Loosen genre, runtime, or mood and try again.</span>
              </div>
            )}
          </div>
        )}

        <div className="pagination browse-pagination">
          <button disabled={normalizedPage === 1} onClick={() => updateFilters({ page: normalizedPage - 1 })}>
            ⬅ Previous
          </button>
          <span>
            Page {normalizedPage} of {totalPages}
          </span>
          <button disabled={normalizedPage === totalPages} onClick={() => updateFilters({ page: normalizedPage + 1 })}>
            Next ➡
          </button>
        </div>
      </div>

      <a href="#library-filters" className="floating-filter-link">
        Back to filters
      </a>
    </div>
  );
}

export default BrowseLibrary;
