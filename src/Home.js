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
  const [pickMode, setPickMode] = useState("just_me");
  const [pickRuntime, setPickRuntime] = useState("any");
  const [pickSource, setPickSource] = useState("feed");
  const [pickCompany, setPickCompany] = useState("any");
  const [pickPrompt, setPickPrompt] = useState("");
  const [movieNightPeople, setMovieNightPeople] = useState("couple");
  const [movieNightAttention, setMovieNightAttention] = useState("medium");
  const [movieNightRisk, setMovieNightRisk] = useState("safe");
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
    setMovieType(normalizedView === "now_playing" ? "latest" : normalizedView);
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
      .get(`${API_BASE_URL}/movies?type=${movieType}&page=${currentPage}`)
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
  }, [movieType, pickCompany, pickMode, pickPrompt, pickRuntime, pickSource, selectedMood, movieNightPeople, movieNightAttention, movieNightRisk]);

  const handleViewChange = (view) => {
    const normalizedView = view === "now_playing" ? "latest" : view;
    setCurrentPage(1);
    setSearchParams({ view: normalizedView });
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

  const viewLabel = getViewLabel(movieType);
  const heading = movieType === "upcoming" ? "Coming Soon" : movieType === "popular" ? "Popular Picks" : "Now Playing";

  const sectionSubtitle = useMemo(() => {
    if (selectedMood !== "all") {
      return `${selectedMoodConfig.label} picks from the current ${viewLabel.toLowerCase()} lineup. Want more options? Open Browse Library.`;
    }

    if (movieType === "popular") {
      return "A wider look at what audiences are responding to right now. Open Browse Library when you want more control.";
    }

    if (movieType === "upcoming") {
      return "A look at what's coming soon. Open Browse Library when you want to narrow the upcoming slate.";
    }

    return "A fresh look at what's in theaters and landing right now. Open Browse Library when you want to dig deeper.";
  }, [movieType, selectedMood, selectedMoodConfig.label, viewLabel]);

  const feedCountLabel = selectedMood === "all" ? `${filteredMovies.length} titles` : `${filteredMovies.length} matches on this page`;
  const heroPreviewLabel = movieType === "upcoming" ? "Coming soon" : movieType === "popular" ? "Popular now" : "Now playing";
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

  const pickSummaryChips = useMemo(() => {
    const runtimeLabel = PICK_RUNTIME_OPTIONS.find((option) => option.id === pickRuntime)?.label || "Any length";
    const companyLabel = PICK_COMPANY_OPTIONS.find((option) => option.id === pickCompany)?.label || "Any setup";

    return [
      pickMode === "movie_night" ? "Movie Night" : "Just Me",
      pickSource === "library" ? "Full library" : "Tonight's feed",
      runtimeLabel,
      pickMode === "movie_night" ? "Group fit" : companyLabel,
      selectedMood !== "all" ? selectedMoodConfig.label : viewLabel,
    ];
  }, [pickCompany, pickMode, pickRuntime, pickSource, selectedMood, selectedMoodConfig.label, viewLabel]);

  const movieNightPreset = useMemo(() => {
    const company = movieNightPeople === "couple" ? "pair" : "friends";
    const runtime = movieNightAttention === "low" ? "under_two_hours" : movieNightAttention === "high" ? "over_two_hours" : "any";
    const promptSeed = `${movieNightRisk}, ${movieNightAttention} attention, good for ${movieNightPeople.replace("_", " ")}`;

    return { company, runtime, promptSeed };
  }, [movieNightAttention, movieNightPeople, movieNightRisk]);

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

      const response = await axios.post(`${API_BASE_URL}/reelbot/pick`, requestPayload, {
        headers: {
          "X-ReelBot-Trigger": "user_click",
        },
      });

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
    const modeOverrides =
      pickMode === "movie_night"
        ? {
            company: movieNightPreset.company,
            runtime: movieNightPreset.runtime,
            prompt: [movieNightPreset.promptSeed, pickPrompt.trim()].filter(Boolean).join(". "),
          }
        : {};

    const nextPreferences = {
      view: movieType,
      mood: selectedMood,
      runtime: pickRuntime,
      source: pickSource,
      company: pickCompany,
      prompt: pickPrompt,
      ...modeOverrides,
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
    await submitPick(
      {},
      {
        scrollToResults: true,
        extraExcludedIds: currentDeckIds,
        refreshKey: Date.now(),
      }
    );
  };

  const handlePickSubmit = async () => {
    await submitPick({}, { scrollToResults: true });
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
            <div className="browse-powered">Fast feeds. Better picks. Less second-guessing.</div>
            <p className="browse-subtitle browse-subtitle--hero">
              Start with ReelBot when you want one strong recommendation, then drop into browsing only if you want to widen the search.
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
        </section>

        <section id="pick-for-me" className="pick-for-me-card pick-for-me-card--primary">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <div className="detail-description-label">Tonight&apos;s main path</div>
              <h2 className="section-title">Get ReelBot&apos;s Pick</h2>
              <p className="section-subtitle">Choose the setup, press one button, and let ReelBot rank a fresh set of candidates instead of looping the same usual picks.</p>
            </div>
          </div>

          <div className="pick-summary-row">
            {pickSummaryChips.map((chip) => (
              <span key={chip} className="pick-summary-chip">
                {chip}
              </span>
            ))}
          </div>

          <div className="pick-tool-grid">
            <div className="pick-control-group">
              <div className="detail-description-label">Mode</div>
              <div className="mood-chip-row" role="group" aria-label="Pick mode">
                <button
                  type="button"
                  className={`mood-rail-chip${pickMode === "just_me" ? " is-active" : ""}`}
                  onClick={() => setPickMode("just_me")}
                >
                  <span className="mood-rail-chip-label">Just Me</span>
                </button>
                <button
                  type="button"
                  className={`mood-rail-chip${pickMode === "movie_night" ? " is-active" : ""}`}
                  onClick={() => setPickMode("movie_night")}
                >
                  <span className="mood-rail-chip-label">Movie Night</span>
                </button>
              </div>
              <p className="pick-control-note">
                {pickMode === "movie_night"
                  ? "Bias the pick toward something the room can agree on."
                  : "Bias the pick toward your personal best fit for tonight."}
              </p>
            </div>

            <div className="pick-control-group">
              <div className="detail-description-label">Search scope</div>
              <div className="mood-chip-row">
                <button
                  type="button"
                  className={`mood-rail-chip${pickSource === "feed" ? " is-active" : ""}`}
                  onClick={() => setPickSource("feed")}
                >
                  <span className="mood-rail-chip-label">Tonight&apos;s feed</span>
                </button>
                <button
                  type="button"
                  className={`mood-rail-chip${pickSource === "library" ? " is-active" : ""}`}
                  onClick={() => setPickSource("library")}
                >
                  <span className="mood-rail-chip-label">Full library</span>
                </button>
              </div>
              <p className="pick-control-note">{pickSource === "library" ? "Search across the broader library." : `Start from the current ${viewLabel.toLowerCase()} feed.`}</p>
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

            {pickMode === "just_me" ? (
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
            ) : null}
          </div>

          {pickMode === "movie_night" ? (
            <MovieNightMode
              embedded
              people={movieNightPeople}
              attention={movieNightAttention}
              risk={movieNightRisk}
              onPeopleChange={setMovieNightPeople}
              onAttentionChange={setMovieNightAttention}
              onRiskChange={setMovieNightRisk}
            />
          ) : null}

          <ReelbotPromptComposer
            label={pickMode === "movie_night" ? "Anything else to steer by?" : "Describe the kind of night"}
            helperText={
              pickMode === "movie_night"
                ? "Optional: add a tone, actor, or example movie and ReelBot will keep it group-friendly."
                : "Optional: add a tone, actor, or example movie and ReelBot will use it as a ranking signal."
            }
            suggestions={DISCOVERY_PROMPTS}
            value={pickPrompt}
            onChange={setPickPrompt}
            placeholder={pickMode === "movie_night" ? "Try: funny but not dumb, crowd-pleasing sci-fi, tense without being too heavy..." : "Try: smart sci-fi, tense but rewarding, funny with friends..."}
          />

          <div className="pick-for-me-actions">
            <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={handlePickSubmit} disabled={pickLoading}>
              {pickLoading ? "ReelBot is picking..." : pickMode === "movie_night" ? "Get tonight's group pick" : "Get a pick"}
            </button>
          </div>
        </section>

        <section id="pick-result" className="pick-result-section" aria-live="polite">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <div className="detail-description-label">Recommendation result</div>
              <h2 className="section-title">{activePick ? "Start here tonight" : "Your pick shows up here"}</h2>
              <p className="section-subtitle">
                {activePick
                  ? "ReelBot puts the main pick up front, explains why it fits, and keeps a few backups nearby without crowding the decision."
                  : "Once ReelBot ranks a fresh pool of candidates, the best fit and a few backups land here."}
              </p>
            </div>
          </div>

          <PickResultPanel
            loading={pickLoading}
            error={pickError}
            rationale={recommendationRationale}
            summary={pickResult?.assistant_note || pickResult?.summary}
            primaryMovie={activePick}
            backupMovies={backupPicks}
            vibeLabel={pickVibeLabel}
            loadingCopy={pickSource === "library" ? "Scanning the library for the strongest fit..." : "ReelBot is finding the best match for tonight..."}
            emptyCopy="Tell ReelBot what kind of night this is. It will give you one confident pick, plus a few smart backups."
            refreshLabel="Show new options"
            backupTitle="Backup picks if the first one doesn’t land"
            backupCopy="A few strong backups that stay in the same lane without fighting the main pick for attention."
            onRefreshChoices={pickResult?.primary ? handleRefreshPick : undefined}
            refreshDisabled={pickLoading}
          />
        </section>

        <section className="secondary-discovery-section">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <div className="detail-description-label">Other ways to explore</div>
              <h2 className="section-title">Widen the search when you want to</h2>
              <p className="section-subtitle">These are follow-on tools after the main pick flow, not competing first steps.</p>
            </div>
          </div>

          <div className="secondary-discovery-grid">
            <aside className="browse-library-card browse-library-card--secondary">
              <div className="detail-description-label">Browse Library</div>
              <h3 className="browse-library-title">Want a wider search?</h3>
              <p className="detail-secondary-text browse-library-copy">
                Browse Library lets you filter by genre, runtime, and mood across now playing, popular, and coming soon.
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
                  Dark Now Playing
                </Link>
              </div>

              <Link to="/browse?view=popular" className="card-link browse-library-cta">
                Open Browse Library
              </Link>
            </aside>

            <section className="mood-rail mood-rail--secondary">
              <div className="section-header section-header--compact section-header--stacked-mobile">
                <div>
                  <div className="detail-description-label">Feed shaping</div>
                  <h3 className="section-title">Tilt the poster grid by mood</h3>
                  <p className="section-subtitle">Use a quick mood pass when you want to browse after the main recommendation.</p>
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
          </div>
        </section>

        <div className="tabs browse-tabs browse-tabs--secondary">
          {VIEW_OPTIONS.map((option) => (
            <button key={option.id} className={movieType === option.id ? "active" : ""} onClick={() => handleViewChange(option.id)}>
              {option.label}
            </button>
          ))}
        </div>

        <div id="movie-grid" className="section-header section-header--stacked-mobile">
          <div>
            <div className="detail-description-label">Poster grid</div>
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
                  <span>Nothing in this feed matches that mood right now.</span>
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
                    This homepage feed only covers a slice of the lineup. Browse Library goes wider when you want more choices.
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
