import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
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
import MovieNightMode from "./components/MovieNightMode";
import PickResultPanel from "./components/PickResultPanel";
import ReelbotPromptComposer from "./components/ReelbotPromptComposer";
import ReelbotSignatureStrip from "./components/ReelbotSignatureStrip";
import useTasteProfile from "./hooks/useTasteProfile";
import { buildRecommendationRationale } from "./recommendationInsights";

function Home() {
  const location = useLocation();
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
  const { profile, actions: tasteActions, getPickExcludedIds } = useTasteProfile();

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

  const hiddenMovieIds = useMemo(() => new Set((profile.skipped || []).map((item) => item.id)), [profile]);
  const visibleMovies = useMemo(() => movies.filter((movie) => !hiddenMovieIds.has(movie.id)), [hiddenMovieIds, movies]);

  const filteredMovies = useMemo(
    () => visibleMovies.filter((movie) => selectedMoodConfig.predicate(movie)),
    [selectedMoodConfig, visibleMovies]
  );

  const heroPreviewMovies = useMemo(() => {
    const source = filteredMovies.length ? filteredMovies : visibleMovies;
    return source.slice(0, 3);
  }, [filteredMovies, visibleMovies]);

  const heading =
    movieType === "upcoming" ? "Coming Soon" : movieType === "popular" ? "Popular Picks" : "Latest Movies";

  const sectionSubtitle = useMemo(() => {
    if (selectedMood !== "all") {
      return `${selectedMoodConfig.label} picks from the current ${getViewLabel(movieType).toLowerCase()} lineup. Want more options? Open Browse Library.`;
    }

    if (movieType === "popular") {
      return "A wider look at what's landing with audiences right now. Open Browse Library when you want more control.";
    }

    if (movieType === "upcoming") {
      return "A look at what's coming soon. Open Browse Library when you want to narrow the upcoming slate.";
    }

    return "A look at what's new right now. Open Browse Library when you want to dig deeper.";
  }, [movieType, selectedMood, selectedMoodConfig.label]);

  const feedCountLabel = selectedMood === "all" ? `${filteredMovies.length} titles` : `${filteredMovies.length} matches on this page`;
  const heroPreviewLabel =
    movieType === "upcoming" ? "Coming soon" : movieType === "popular" ? "Popular now" : "On this page";
  const browseLibraryPath = `/browse?view=${movieType}${selectedMood !== "all" ? `&mood=${selectedMood}` : ""}`;
  const browseLibraryResultsPath = `${browseLibraryPath}#library-results`;
  const activePick = pickResult?.primary || null;
  const backupPicks = pickResult?.alternates || [];
  const recommendationRationale = useMemo(
    () => buildRecommendationRationale({ pickResult, activePick }),
    [pickResult, activePick]
  );
  const pickVibeLabel = useMemo(() => {
    if (pickPrompt.trim()) {
      return pickPrompt.trim();
    }

    return recommendationRationale?.criteria?.map((item) => item.label).join(" • ") || "";
  }, [pickPrompt, recommendationRationale]);

  const requestPick = async (nextPreferences, options = {}) => {
    try {
      setPickLoading(true);
      setPickError(null);
      tasteActions.savePickPreferences(nextPreferences);

      const requestPayload = {
        ...nextPreferences,
        excluded_ids: getPickExcludedIds(nextPreferences, options.extraExcludedIds || []),
        trigger: "user_click",
      };

      if (options.refreshKey) {
        requestPayload.refresh_key = options.refreshKey;
      }

      const response = await axios.post(
        `${API_BASE_URL}/reelbot/pick`,
        requestPayload,
        {
          headers: {
            "X-ReelBot-Trigger": "user_click",
          },
        }
      );

      setPickResult(response.data);
      tasteActions.recordPickResult(nextPreferences, response.data);

      if (options.scrollToResults) {
        scrollToSection("pick-result");
      }
    } catch (requestError) {
      console.error("Error fetching ReelBot pick:", requestError);
      setPickError("ReelBot could not pull a pick right now.");
    } finally {
      setPickLoading(false);
    }
  };

  const submitPick = async (overrides = {}, options = {}) => {
    const nextPreferences = {
      view: movieType,
      mood: selectedMood,
      runtime: pickRuntime,
      source: pickSource,
      company: pickCompany,
      prompt: pickPrompt,
      ...overrides,
    };

    if (Object.prototype.hasOwnProperty.call(overrides, "runtime")) {
      setPickRuntime(nextPreferences.runtime);
    }

    if (Object.prototype.hasOwnProperty.call(overrides, "source")) {
      setPickSource(nextPreferences.source);
    }

    if (Object.prototype.hasOwnProperty.call(overrides, "company")) {
      setPickCompany(nextPreferences.company);
    }

    if (Object.prototype.hasOwnProperty.call(overrides, "prompt")) {
      setPickPrompt(nextPreferences.prompt);
    }

    await requestPick(nextPreferences, options);
  };

  const handleRefreshPick = async () => {
    const currentDeckIds = [pickResult?.primary?.id, ...((pickResult?.alternates || []).map((movie) => movie.id))].filter(Boolean);
    await submitPick({}, {
      scrollToResults: true,
      extraExcludedIds: currentDeckIds,
      refreshKey: Date.now(),
    });
  };

  const handleApplyMovieNightMode = async ({ company, runtime, prompt }) => {
    await submitPick(
      {
        company,
        runtime,
        prompt,
        source: "library",
      },
      { scrollToResults: true }
    );
  };

  const handlePickSubmit = async () => {
    await submitPick();
  };


  const handleHeroSearch = async (event) => {
    event.preventDefault();
    if (!query.trim()) {
      scrollToSection("pick-for-me");
      return;
    }

    await submitPick(
      {
        prompt: query.trim(),
        source: "library",
      },
      {
        scrollToResults: true,
        refreshKey: `hero-search-${Date.now()}`,
      }
    );
  };

  return (
    <div className="browse-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--with-search">
          <div className="browse-copy">
            <div className="browse-kicker">ReelBot</div>
            <h1 className="browse-title browse-title--brand">What should I watch tonight?</h1>
            <div className="browse-powered">Get one smart pick, plus backups</div>
            <p className="browse-subtitle browse-subtitle--hero">
              Tell ReelBot the mood, runtime, and who you're watching with. Search or browse if you already know what you want, but start here when you want help choosing.
            </p>

            <div className="browse-hero-actions">
              <a href="#pick-for-me" className="reelbot-inline-button reelbot-inline-button--solid">
                Get ReelBot&apos;s pick
              </a>
              <button type="button" className="reelbot-inline-button" onClick={() => setShowCapabilities(true)}>
                See how ReelBot helps
              </button>
            </div>
          </div>

          <div className="browse-hero-aside">
            <form
              onSubmit={handleHeroSearch}
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
                        <div className="hero-preview-poster hero-preview-poster--placeholder">Poster unavailable</div>
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
                <div className="detail-description-label">Tonight&apos;s fastest path</div>
                <h2 className="section-title">Get ReelBot&apos;s Pick</h2>
                <p className="section-subtitle">Tell ReelBot the setup and it will make one confident recommendation, then line up a few strong backups if you want another lane.</p>
                <ReelbotSignatureStrip className="reelbot-signature-strip--panel" />
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
                  <span className="mood-rail-chip-label">This page</span>
                </button>
                <button
                  type="button"
                  className={`mood-rail-chip${pickSource === "library" ? " is-active" : ""}`}
                  onClick={() => setPickSource("library")}
                >
                  <span className="mood-rail-chip-label">Full library</span>
                </button>
              </div>
              <p className="pick-control-note">{pickSource === "library" ? "Looks across the full library." : "Only picks from what's showing on this page."}</p>
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

            <ReelbotPromptComposer
              label="Describe the kind of night"
              helperText="Try a tone, an actor, or a movie you want it to feel close to."
              suggestions={DISCOVERY_PROMPTS}
              value={pickPrompt}
              onChange={setPickPrompt}
              placeholder="Try: smart sci-fi, tense but rewarding, funny with friends..."
            />

            <div className="pick-for-me-actions">
              <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={handlePickSubmit} disabled={pickLoading}>
                {pickLoading ? "ReelBot is picking..." : pickSource === "library" ? "Search full library" : "Get a pick"}
              </button>
            </div>

            <PickResultPanel
              id="pick-result"
              loading={pickLoading}
              error={pickError}
              rationale={recommendationRationale}
              summary={pickResult?.summary}
              primaryMovie={activePick}
              backupMovies={backupPicks}
              vibeLabel={pickVibeLabel}
              loadingCopy="ReelBot is lining up the best fit and a few backup options..."
              emptyCopy="Tell ReelBot what kind of night this is. It will give you one confident pick, plus a few smart backups."
              refreshLabel="Show new options"
              backupTitle="Backup picks if the first one doesn’t land"
              backupCopy="A few strong backups that stay in the same lane without fighting the main pick for attention."
              onRefreshChoices={pickResult?.primary ? handleRefreshPick : undefined}
              refreshDisabled={pickLoading}
            />
          </div>

          <aside className="browse-library-card">
            <div className="detail-description-label">Browse Library</div>
            <h2 className="browse-library-title">Want a wider search?</h2>
            <p className="detail-secondary-text browse-library-copy">
              Browse Library lets you filter by genre, runtime, and mood across latest, popular, and coming soon.
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
              Open Browse Library
            </Link>
          </aside>

          <MovieNightMode onApply={handleApplyMovieNightMode} loading={pickLoading} />

          <section className="mood-rail">
            <div className="section-header section-header--compact section-header--stacked-mobile">
              <div>
                <h2 className="section-title">Shape this feed by mood</h2>
                <p className="section-subtitle">Quickly tilt the lineup lighter, darker, funnier, or more emotional.</p>
              </div>
              <div className="mood-rail-actions">
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
                        <div className="no-poster">Poster unavailable</div>
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
                  <span>Nothing on this page matches that mood right now.</span>
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
                    This homepage view only covers what's on this page. Browse Library goes wider when you want more choices.
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
