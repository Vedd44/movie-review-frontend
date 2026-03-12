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
import { passesSignalFloor } from "./movieSignals";
import { buildBreadcrumbJsonLd, buildItemListJsonLd, usePageMetadata } from "./seo";

const LIBRARY_PROMPTS = [...DISCOVERY_PROMPTS, "Popular sci-fi with real payoff", "A punchy action movie with a real star"];

const getMovieGenreNames = (movie, genreLookup) =>
  (Array.isArray(movie?.genre_ids) ? movie.genre_ids : [])
    .map((genreId) => genreLookup.get(String(genreId)))
    .filter(Boolean);

const getMovieVibeTags = (movie, genreLookup) => {
  const tags = [];
  const genreNames = getMovieGenreNames(movie, genreLookup);
  const runtime = Number(movie?.runtime || 0);

  if (runtime && runtime <= 105) tags.push("Easy watch");
  if (runtime >= 145 || genreNames.includes("Drama") || genreNames.includes("History")) tags.push("Slow burn");
  if (genreNames.some((name) => ["Thriller", "Horror", "Action", "Crime"].includes(name))) tags.push("Intense");
  if (genreNames.some((name) => ["Drama", "Romance", "Music", "Animation"].includes(name))) tags.push("Emotional");

  return tags.slice(0, 2);
};

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
  const genreLookup = useMemo(() => new Map(genres.map((genre) => [String(genre.id), genre.name])), [genres]);

  const hiddenMovieIds = useMemo(() => new Set((profile.skipped || []).map((item) => item.id)), [profile]);

  const filteredMovies = useMemo(
    () => movies.filter(
      (movie) =>
        !hiddenMovieIds.has(movie.id)
        && selectedMoodConfig.predicate(movie)
        && passesSignalFloor(movie, { sourceType: normalizedView, allowReleaseSource: true, threshold: 10 })
    ),
    [hiddenMovieIds, movies, normalizedView, selectedMoodConfig]
  );

  const libraryRationale = useMemo(
    () => buildRecommendationRationale({ pickResult, activePick: pickResult?.primary, profile }),
    [pickResult, profile]
  );
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

  const handleRemoveFilter = (filterId) => {
    if (filterId === "view") {
      updateFilters({ view: "popular" });
      return;
    }

    if (filterId === "genre") {
      updateFilters({ genre: "all" });
      return;
    }

    if (filterId === "runtime") {
      updateFilters({ runtime: "any" });
      return;
    }

    updateFilters({ mood: "all" });
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

      const response = await axios.post(
        `${API_BASE_URL}/reelbot/pick`,
        {
          ...nextPreferences,
          excluded_ids: getPickExcludedIds(nextPreferences, options.extraExcludedIds || []),
          refresh_key: options.refreshKey,
          trigger: "user_click",
        },
        {
          headers: {
            "X-ReelBot-Trigger": "user_click",
          },
        }
      );

      setPickResult(response.data);
      tasteActions.recordPickResult(nextPreferences, response.data);
      document.getElementById("library-reelbot-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (requestError) {
      console.error("Error fetching library ReelBot pick:", requestError);
      setPickError("ReelBot could not narrow the library right now.");
    } finally {
      setPickLoading(false);
    }
  };

  const handleLibraryPick = async () => {
    await requestLibraryPick({ refreshKey: `browse-pick-${Date.now()}` });
  };

  const handleRefreshLibraryPick = async () => {
    const currentDeckIds = [pickResult?.primary?.id, ...((pickResult?.alternates || []).map((movie) => movie.id))].filter(Boolean);
    await requestLibraryPick({ extraExcludedIds: currentDeckIds, refreshKey: `browse-refresh-${Date.now()}` });
  };

  const activeFilterChips = useMemo(
    () => [
      { id: "view", label: getViewLabel(normalizedView) },
      { id: "genre", label: selectedGenreLabel },
      { id: "runtime", label: PICK_RUNTIME_OPTIONS.find((option) => option.id === normalizedRuntime)?.label || "Any length" },
      { id: "mood", label: selectedMoodConfig.label },
    ],
    [normalizedRuntime, normalizedView, selectedGenreLabel, selectedMoodConfig.label]
  );

  const browseStructuredData = useMemo(
    () => [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Browse", path: "/browse" },
      ]),
      filteredMovies.length
        ? buildItemListJsonLd(
            filteredMovies.slice(0, 12).map((movie) => ({
              name: movie.title,
              path: getMoviePath(movie),
            }))
          )
        : null,
    ].filter(Boolean),
    [filteredMovies]
  );

  usePageMetadata({
    title: "Browse Movies by Genre, Mood, and Runtime | ReelBot",
    description: "Browse movies by genre, mood, runtime, and release state, then let ReelBot narrow the options.",
    path: "/browse",
    structuredData: browseStructuredData,
  });

  return (
    <div className="browse-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo">
          <div className="browse-copy">
            <div className="browse-kicker">Browse Library</div>
            <h1 className="browse-title">Browse Movies</h1>
            <p className="browse-subtitle browse-subtitle--hero">
              Start broad, then narrow by genre, runtime, mood, or source.
            </p>
          </div>
        </section>

        <section id="library-filters" className="library-filters-card">
          <div className="section-header section-header--stacked-mobile section-header--compact">
            <div>
              <div className="detail-description-label">Browse controls</div>
              <h2 className="section-title">Filter the lineup</h2>
              <p className="section-subtitle">Filter by source, genre, runtime, and mood without losing the poster-first feel.</p>
            </div>
                      </div>

          <div className="filter-group-stack">
            <div className="filter-group-row">
              <div className="filter-group-head">
                <div className="detail-description-label">Source</div>
                <p className="detail-secondary-text">Choose a feed to start browsing.</p>
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
            </div>

            <div className="filter-group-row">
              <div className="filter-group-head">
                <div className="detail-description-label">Genre</div>
                <p className="detail-secondary-text">Start broad, then narrow into a stronger lane.</p>
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
                <div className="detail-description-label">Mood</div>
                <p className="detail-secondary-text">Tilt the grid toward the tone you want right now.</p>
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

        <div className="browse-filter-summary-bar">
          <div className="detail-description-label">Active filters</div>
          <div className="browse-filter-summary-chips">
            {activeFilterChips.map((chip) => (
              <button key={chip.id} type="button" className="pick-summary-chip pick-summary-chip--dismissable" onClick={() => handleRemoveFilter(chip.id)} aria-label={`Remove ${chip.label}`}>
                <span>{chip.label}</span>
                <span className="pick-summary-chip-x" aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        </div>

        <details className="pick-for-me-card library-reelbot-card library-reelbot-card--collapsed" open={Boolean(pickResult?.primary || pickError || pickLoading)}>
          <summary className="library-reelbot-summary"><span>Let ReelBot choose from these filters</span><span className="library-reelbot-summary-cta">Ask ReelBot →</span></summary>
          <div className="library-reelbot-body">
            <div className="section-header section-header--stacked-mobile section-header--compact">
              <div>
                <h2 className="section-title">Let ReelBot choose</h2>
                <p className="section-subtitle">Keep the filters you already set, add a vibe if you want, and let ReelBot make the call.</p>
                <ReelbotSignatureStrip className="reelbot-signature-strip--panel" />
              </div>
            </div>

            <ReelbotPromptComposer
              label="Add a vibe"
              helperText="Optional: add a vibe if you want to sharpen the pick."
              suggestions={LIBRARY_PROMPTS.slice(0, 4)}
              value={pickPrompt}
              onChange={setPickPrompt}
              placeholder="Try: smart sci-fi under 2 hours, dark but rewarding, or a strong date-night pick"
            />

            <div className="pick-for-me-actions">
              <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={handleLibraryPick} disabled={pickLoading}>
                {pickLoading ? "ReelBot is picking..." : "Ask ReelBot"}
              </button>
            </div>

            <div id="library-reelbot-result">
              <PickResultPanel
                loading={pickLoading}
                error={pickError}
                rationale={libraryRationale}
                summary={libraryRationale?.summaryLine || pickResult?.summary}
                primaryMovie={pickResult?.primary}
                backupMovies={pickResult?.alternates || []}
                vibeLabel={libraryVibeLabel}
                loadingCopy="Ranking the best match from your filtered library..."
                emptyCopy="Let ReelBot choose from these filters, or add a vibe to steer the pick."
                refreshLabel="Swap Pick"
                backupTitle="Other good options tonight"
                onRefreshChoices={pickResult?.primary ? handleRefreshLibraryPick : undefined}
                refreshDisabled={pickLoading}
              />
            </div>
          </div>
        </details>

        <div id="library-results" className="section-header section-header--stacked-mobile">
          <div>
            <div className="detail-description-label">Browse results</div>
            <h2 className="section-title">Library Results</h2>
            <p className="section-subtitle">{selectedGenreLabel} • {selectedMoodConfig.label} • {PICK_RUNTIME_OPTIONS.find((option) => option.id === normalizedRuntime)?.label || "Any length"}</p>
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
              filteredMovies.map((movie) => {
                const genreNames = getMovieGenreNames(movie, genreLookup);
                const vibeTags = getMovieVibeTags(movie, genreLookup);
                return (
                <article
                  key={movie.id}
                  className="movie-card movie-card--browse"
                >
                  <div className="movie-poster-shell">
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
                    <div className="movie-hover-preview">
                      <div className="movie-hover-preview-head">
                        <div className="movie-hover-title">{movie.title}</div>
                        <div className="movie-hover-meta">
                          <span>{getReleaseYear(movie.release_date)}</span>
                          <span>{movie.runtime ? `${movie.runtime} min` : "Runtime TBA"}</span>
                          {movie.vote_average ? <span>TMDB {movie.vote_average.toFixed(1)}</span> : null}
                        </div>
                      </div>
                      {genreNames.length ? <div className="movie-hover-genres">{genreNames.slice(0, 3).join(" • ")}</div> : null}
                      {vibeTags.length ? (
                        <div className="movie-hover-tags">
                          {vibeTags.map((tag) => (
                            <span key={tag} className="movie-hover-tag">{tag}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="movie-hover-actions">
                        <Link to={getMoviePath(movie)} className="card-link movie-hover-link">
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>

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
              );})
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
