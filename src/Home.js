import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import {
  API_BASE_URL,
  DISCOVERY_PROMPTS,
  MOOD_FILTERS,
  PICK_COMPANY_OPTIONS,
  PICK_RUNTIME_OPTIONS,
  REELBOT_CAPABILITIES,
  VALID_VIEWS,
  VIEW_OPTIONS,
  formatMovieDate,
  getReleaseYear,
  getViewLabel,
  getMoviePath,
} from "./discovery";

function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get("view");
  const normalizedInitialView = VALID_VIEWS.has(initialView) ? initialView : "latest";

  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movieType, setMovieType] = useState(normalizedInitialView);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedMood, setSelectedMood] = useState("all");
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [pickRuntime, setPickRuntime] = useState("any");
  const [pickSource, setPickSource] = useState("feed");
  const [pickCompany, setPickCompany] = useState("any");
  const [pickPrompt, setPickPrompt] = useState("");
  const [pickLoading, setPickLoading] = useState(false);
  const [pickError, setPickError] = useState(null);
  const [pickResult, setPickResult] = useState(null);

  const scrollToSection = (id) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  useEffect(() => {
    const view = searchParams.get("view");
    const normalizedView = VALID_VIEWS.has(view) ? view : "latest";
    setMovieType(normalizedView);
  }, [searchParams]);

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
  }, [location.hash, loading, movieType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [movieType]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    axios
      .get(`${API_BASE_URL}/movies?type=${movieType}&page=${currentPage}${currentPage === 1 ? "&fill=20" : ""}`)
      .then((response) => {
        setMovies(response.data.results || []);
        setTotalPages(response.data.total_pages || 1);
      })
      .catch((requestError) => {
        console.error(`Error fetching ${movieType} movies:`, requestError);
        setError(`Failed to fetch ${movieType} movies.`);
      })
      .finally(() => {
        setLoading(false);
      });
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
    setPickResult(null);
  }, [movieType, pickCompany, pickPrompt, pickRuntime, pickSource, selectedMood]);

  const handleViewChange = (view) => {
    setCurrentPage(1);
    setSearchParams({ view });
    scrollToSection("movie-grid");
  };

  const selectedMoodConfig = useMemo(
    () => MOOD_FILTERS.find((filter) => filter.id === selectedMood) || MOOD_FILTERS[0],
    [selectedMood]
  );

  const filteredMovies = useMemo(
    () => movies.filter((movie) => selectedMoodConfig.predicate(movie)),
    [movies, selectedMoodConfig]
  );

  const heroPreviewMovies = useMemo(() => {
    const source = filteredMovies.length ? filteredMovies : movies;
    return source.slice(0, 3);
  }, [filteredMovies, movies]);

  const heading =
    movieType === "upcoming" ? "Coming Soon" : movieType === "popular" ? "Popular Picks" : "Latest Movies";

  const sectionSubtitle = useMemo(() => {
    if (selectedMood !== "all") {
      return `A ${selectedMoodConfig.label.toLowerCase()} pass on the current ${getViewLabel(movieType).toLowerCase()} feed. Need more range than this page? Open Browse Library.`;
    }

    if (movieType === "popular") {
      return "A broader popularity-led sample. Open Browse Library when you want genre, runtime, and mood control across a deeper catalog.";
    }

    if (movieType === "upcoming") {
      return "A sharper look at what's coming soon. Open Browse Library when you want to filter the upcoming slate with more intent.";
    }

    return "A current sample of what is landing now. Browse the feed for range, or open Browse Library when you want deeper filtering.";
  }, [movieType, selectedMood, selectedMoodConfig.label]);

  const feedCountLabel = selectedMood === "all" ? `${filteredMovies.length} titles` : `${filteredMovies.length} matches on this page`;
  const heroPreviewLabel =
    movieType === "upcoming" ? "Coming soon now" : movieType === "popular" ? "Popular right now" : "In this feed now";
  const browseLibraryPath = `/browse?view=${movieType}${selectedMood !== "all" ? `&mood=${selectedMood}` : ""}`;
  const browseLibraryResultsPath = `${browseLibraryPath}#library-results`;

  const handlePickSubmit = async () => {
    try {
      setPickLoading(true);
      setPickError(null);

      const response = await axios.post(
        `${API_BASE_URL}/reelbot/pick`,
        {
          view: movieType,
          mood: selectedMood,
          runtime: pickRuntime,
          source: pickSource,
          company: pickCompany,
          prompt: pickPrompt,
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
      console.error("Error fetching ReelBot pick:", requestError);
      setPickError("ReelBot could not pull a pick right now.");
    } finally {
      setPickLoading(false);
    }
  };

  return (
    <div className="browse-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--with-search">
          <div className="browse-copy">
            <h1 className="browse-title browse-title--brand">ReelBot</h1>
            <div className="browse-powered">Built with TMDB &amp; OpenAI</div>
            <p className="browse-subtitle browse-subtitle--hero">
              Find something worth watching faster. Search when you know the title, browse the current feed when you want range, or let ReelBot narrow the night down when you&apos;re stuck.
            </p>

            <div className="browse-hero-actions">
              <a href="#pick-for-me" className="reelbot-inline-button reelbot-inline-button--solid">
                Jump to Pick for Me
              </a>
              <button type="button" className="reelbot-inline-button" onClick={() => setShowCapabilities(true)}>
                How ReelBot helps you decide
              </button>
            </div>
          </div>

          <div className="browse-hero-aside">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!query.trim()) {
                  return;
                }
                navigate(`/search?q=${encodeURIComponent(query.trim())}`);
              }}
              className="search-bar search-bar--hero"
            >
              <input
                type="text"
                placeholder="Search for a movie..."
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
                        <div className="hero-preview-poster hero-preview-poster--placeholder">No image</div>
                      )}
                      <span className="hero-preview-title">{movie.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <div className="tabs browse-tabs">
          {VIEW_OPTIONS.map((option) => (
            <button key={option.id} className={movieType === option.id ? "active" : ""} onClick={() => handleViewChange(option.id)}>
              {option.label}
            </button>
          ))}
        </div>

        <section className="browse-decision-grid">
          <div id="pick-for-me" className="pick-for-me-card">
            <div className="section-header section-header--compact section-header--stacked-mobile">
              <div>
                <h2 className="section-title">Pick for Me</h2>
                <p className="section-subtitle">Choose the vibe, duration, and setup. ReelBot gives you one best-fit pick plus backups.</p>
              </div>
            </div>

            <div className="pick-control-group">
              <div className="detail-description-label">Search scope</div>
              <div className="mood-chip-row">
                <button
                  type="button"
                  className={`mood-rail-chip${pickSource === "feed" ? " is-active" : ""}`}
                  onClick={() => setPickSource("feed")}
                >
                  <span className="mood-rail-chip-label">This feed</span>
                </button>
                <button
                  type="button"
                  className={`mood-rail-chip${pickSource === "library" ? " is-active" : ""}`}
                  onClick={() => setPickSource("library")}
                >
                  <span className="mood-rail-chip-label">Whole library</span>
                </button>
              </div>
              <p className="pick-control-note">{pickSource === "library" ? "Searches beyond this feed." : "Stays anchored to the current feed."}</p>
            </div>

            <div className="pick-control-group">
              <div className="detail-description-label">Duration</div>
              <div className="mood-chip-row">
                {PICK_RUNTIME_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`mood-rail-chip${pickRuntime === option.id ? " is-active" : ""}`}
                    onClick={() => setPickRuntime(option.id)}
                  >
                    <span className="mood-rail-chip-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pick-control-group">
              <div className="detail-description-label">Watching with</div>
              <div className="mood-chip-row">
                {PICK_COMPANY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`mood-rail-chip${pickCompany === option.id ? " is-active" : ""}`}
                    onClick={() => setPickCompany(option.id)}
                  >
                    <span className="mood-rail-chip-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pick-control-group pick-control-group--prompt">
              <div className="detail-description-label">Vibe</div>
              <div className="pick-prompt-suggestions">
                {DISCOVERY_PROMPTS.map((prompt) => (
                  <button key={prompt} type="button" className="mood-rail-chip pick-prompt-chip" onClick={() => setPickPrompt(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="pick-prompt-shell">
                <input
                  type="text"
                  className="pick-prompt-input"
                  placeholder="Try: smart sci-fi, tense but rewarding, funny with friends..."
                  value={pickPrompt}
                  onChange={(event) => setPickPrompt(event.target.value)}
                />
              </div>
            </div>

            <div className="pick-for-me-actions">
              <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={handlePickSubmit} disabled={pickLoading}>
                {pickLoading ? "ReelBot is picking..." : pickSource === "library" ? "Search library" : "Get a pick"}
              </button>
            </div>

            <div className={`pick-result-stage${pickResult?.primary ? " is-live" : ""}${!pickResult?.primary && !pickLoading ? " pick-result-stage--empty" : ""}`}>
              {pickError ? <p className="error-message">{pickError}</p> : null}

              {!pickError && pickLoading ? (
                <div className="reelbot-loading-state">
                  <span className="reelbot-loading-dot" aria-hidden="true"></span>
                  <p className="detail-secondary-text reelbot-placeholder-copy">ReelBot is filtering the catalog and tightening tonight&apos;s best fit...</p>
                </div>
              ) : null}

              {!pickError && !pickLoading && pickResult?.primary ? (
                <>
                  <div className="pick-result-copy">
                    <div className="detail-description-label">Tonight&apos;s best fit</div>
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
                  {pickResult?.summary ? <p className="detail-secondary-text pick-soft-fallback">{pickResult.summary}</p> : null}
                  <p className="pick-empty-note detail-secondary-text">
                    {pickSource === "library"
                      ? "Use Whole library when you want ReelBot to cast a wider net."
                      : `Stay on This feed when you want the pick to reflect the current ${getViewLabel(movieType).toLowerCase()} selection.`}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="browse-library-card">
            <div className="detail-description-label">Browse Library</div>
            <h2 className="browse-library-title">Need more than this feed?</h2>
            <p className="detail-secondary-text browse-library-copy">
              Browse Library opens up genre, runtime, and mood filters across latest, popular, and coming soon.
            </p>

            <div className="browse-library-links">
              <Link to="/browse?view=popular&genre=878#library-results" className="browse-library-link">
                Popular Sci-Fi
              </Link>
              <Link to="/browse?view=popular&runtime=under_two_hours#library-results" className="browse-library-link">
                Under 100 Minutes
              </Link>
              <Link to="/browse?view=popular&genre=10749&runtime=under_two_hours#library-results" className="browse-library-link">
                Date-Night Range
              </Link>
              <Link to="/browse?view=latest&mood=dark#library-results" className="browse-library-link">
                Latest Dark Picks
              </Link>
            </div>

            <Link to="/browse?view=popular" className="card-link browse-library-cta">
              Open full library
            </Link>
          </aside>

          <section className="mood-rail">
            <div className="section-header section-header--compact section-header--stacked-mobile">
              <div>
                <h2 className="section-title">Filter this feed by mood</h2>
                <p className="section-subtitle">Use this to refine the poster grid below. It can still inform Pick for Me, but its main job here is shaping the feed.</p>
              </div>
              <div className="mood-rail-actions">
                <span className="results-count results-count--context">Poster grid filter</span>
                <Link to={browseLibraryResultsPath} className="browse-library-link browse-library-link--header">
                  Open Browse Library
                </Link>
              </div>
            </div>

            <div className="mood-chip-row" role="group" aria-label="Filter movies by mood">
              {MOOD_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`mood-rail-chip${selectedMood === filter.id ? " is-active" : ""}`}
                  onClick={() => setSelectedMood(filter.id)}
                  title={filter.hint}
                  aria-pressed={selectedMood === filter.id}
                >
                  <span className="mood-rail-chip-label">{filter.label}</span>
                </button>
              ))}
            </div>
          </section>
        </section>

        <div id="movie-grid" className="section-header section-header--stacked-mobile">
          <div>
            <h2 className="section-title">{heading}</h2>
            <p className="section-subtitle">{sectionSubtitle}</p>
          </div>
          <div className="results-count">{feedCountLabel}</div>
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
                <div className="empty-state feed-empty-state">
                  <span className="status-glyph" aria-hidden="true"></span>
                  <span>Nothing in this page sample fits that lane right now.</span>
                  <Link to={browseLibraryResultsPath} className="card-link">
                    Open Browse Library
                  </Link>
                </div>
              )}
            </div>

            {selectedMood !== "all" && filteredMovies.length > 0 && filteredMovies.length < 8 ? (
              <div className="feed-followup-card">
                <div>
                  <div className="detail-description-label">Want more {selectedMoodConfig.label.toLowerCase()} picks?</div>
                  <p className="detail-secondary-text">
                    This homepage mood pass only filters the current {getViewLabel(movieType).toLowerCase()} feed. Browse Library goes wider when you want more depth.
                  </p>
                </div>
                <Link to={browseLibraryResultsPath} className="card-link">
                  Open Browse Library
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
            <p className="reelbot-modal-copy">Browse on your own first, then bring in ReelBot when you want a faster read, a better match, or a clean tie-breaker.</p>

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
