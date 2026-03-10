import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import PickResultPanel from "./components/PickResultPanel";
import ReelbotPromptComposer from "./components/ReelbotPromptComposer";
import ReelbotSignatureStrip from "./components/ReelbotSignatureStrip";
import useTasteProfile from "./hooks/useTasteProfile";
import { buildRecommendationRationale } from "./recommendationInsights";
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
  const { profile, actions: tasteActions, getPickExcludedIds } = useTasteProfile();

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

  const hiddenMovieIds = useMemo(() => new Set((profile.skipped || []).map((item) => item.id)), [profile]);

  const filteredMovies = useMemo(
    () => movies.filter((movie) => !hiddenMovieIds.has(movie.id) && selectedMoodConfig.predicate(movie)),
    [hiddenMovieIds, movies, selectedMoodConfig]
  );

  const libraryRationale = useMemo(() => buildRecommendationRationale({ pickResult, activePick: pickResult?.primary }), [pickResult]);
  const libraryVibeLabel = useMemo(() => pickPrompt.trim() || selectedMoodConfig.label, [pickPrompt, selectedMoodConfig.label]);

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

  const requestLibraryPick = async (options = {}) => {
    const nextPreferences = {
      view: normalizedView,
      mood: normalizedMood,
      runtime: normalizedRuntime,
      source: "library",
      company: "any",
      prompt: pickPrompt,
      genre: normalizedGenre,
    };

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
    } catch (requestError) {
      console.error("Error fetching browse ReelBot pick:", requestError);
      setPickError("ReelBot could not pull a library pick right now.");
    } finally {
      setPickLoading(false);
    }
  };

  const handleLibraryPick = async () => {
    await requestLibraryPick();
  };

  const handleRefreshLibraryPick = async () => {
    const currentDeckIds = [pickResult?.primary?.id, ...((pickResult?.alternates || []).map((movie) => movie.id))].filter(Boolean);
    await requestLibraryPick({
      extraExcludedIds: currentDeckIds,
      refreshKey: Date.now(),
    });
  };

  return (
    <div className="browse-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo">
          <div className="browse-copy">
            <div className="browse-kicker">Browse Library</div>
            <h1 className="browse-title">Browse the full library</h1>
            <p className="browse-subtitle browse-subtitle--hero">
              Set the lane with filters, then let ReelBot break the tie when you want one confident pick instead of a wall of options.
            </p>
          </div>
        </section>

        <section id="library-filters" className="library-filters-card">
          <div className="section-header section-header--stacked-mobile section-header--compact">
            <div>
              <h2 className="section-title">Browse your way</h2>
              <p className="section-subtitle">Start broad, then narrow the lane when you want ReelBot working with a more intentional setup.</p>
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
                <p className="detail-secondary-text">Start broad, then narrow to the kind of movie you want.</p>
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
                <p className="detail-secondary-text">Useful when time is the deciding factor.</p>
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
                <p className="detail-secondary-text">Use mood last when you want to sharpen the results without shrinking them too quickly.</p>
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
              <p className="section-subtitle">Keep your filters, then add a vibe, actor, or reference title when you want ReelBot to make the call instead of you.</p>
              <ReelbotSignatureStrip className="reelbot-signature-strip--panel" />
            </div>
            <a href="#library-filters" className="browse-library-link browse-library-link--header">
              Back to filters
            </a>
          </div>

          <ReelbotPromptComposer
            label="Describe what you're after"
            helperText="ReelBot uses your filters and your prompt together."
            suggestions={LIBRARY_PROMPTS}
            value={pickPrompt}
            onChange={setPickPrompt}
            placeholder="Try: smart sci-fi under 2 hours, a strong date-night pick, dark but rewarding..."
          />

          <div className="pick-for-me-actions">
            <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={handleLibraryPick} disabled={pickLoading}>
              {pickLoading ? "ReelBot is picking..." : "Ask ReelBot"}
            </button>
          </div>

          <PickResultPanel
            loading={pickLoading}
            error={pickError}
            rationale={libraryRationale}
            summary={pickResult?.summary}
            primaryMovie={pickResult?.primary}
            backupMovies={pickResult?.alternates || []}
            vibeLabel={libraryVibeLabel}
            loadingCopy="ReelBot is narrowing the library to the best fit..."
            emptyCopy="Add a vibe if you want, or let ReelBot choose from the filters you already set."
            refreshLabel="Show new options"
            backupTitle="A few strong backups for the same setup"
            backupCopy="Strong alternates if the first option is close, but not quite the call you want to make."
            onRefreshChoices={pickResult?.primary ? handleRefreshLibraryPick : undefined}
            refreshDisabled={pickLoading}
          />
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
