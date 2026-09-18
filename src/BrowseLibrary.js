import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import PickResultPanel from "./components/PickResultPanel";
import ReelbotPromptComposer from "./components/ReelbotPromptComposer";
import ReelbotSignatureStrip from "./components/ReelbotSignatureStrip";
import { hasBehavioralSignals, scoreMovieForBehavioralMemory } from "./behavioralMemory";
import { useAuth } from "./context/AuthContext";
import useTasteProfile from "./hooks/useTasteProfile";
import { buildRecommendationRationale } from "./recommendationInsights";
import { buildSwapQueueFromPayload, dedupeIds, mergeSwapQueue, normalizePickPayload, promoteQueuedPick } from "./reelbotSession";
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
import { useAskReelbotPageContext } from "./context/AskReelbotContext";
import { trackProductEvent } from "./analytics";

const LIBRARY_PROMPTS = [...DISCOVERY_PROMPTS, "Popular sci-fi with real payoff", "A punchy action movie with a real star"];
const BROWSE_VIEW_OPTIONS = VIEW_OPTIONS;
const LIBRARY_REFINE_ACTIONS = [
  { id: "lighter", label: "Lighter", loadingMessage: "Looking for something a little lighter…" },
  { id: "darker", label: "Darker", loadingMessage: "Taking this in a darker direction…" },
  { id: "shorter", label: "Shorter", loadingMessage: "Tightening the runtime a bit…" },
  { id: "more_like_this", label: "More like this", loadingMessage: "Staying close to this pick…" },
  { id: "different_angle", label: "Different angle", loadingMessage: "Trying a nearby angle…" },
];
const getAvailabilityStatus = (movie) => movie?.availability_status || null;
const shouldShowAvailabilityChip = (status) => Boolean(status?.theater_only && status?.label);

export const mergeBrowseMoviePages = (currentMovies = [], incomingMovies = [], replace = false) => {
  if (replace) return incomingMovies;
  const movieMap = new Map(currentMovies.map((movie) => [movie.id, movie]));
  incomingMovies.forEach((movie) => {
    if (movie?.id && !movieMap.has(movie.id)) movieMap.set(movie.id, movie);
  });
  return Array.from(movieMap.values());
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [genreLoading, setGenreLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [showReelbotPicker, setShowReelbotPicker] = useState(false);
  const [pickPrompt, setPickPrompt] = useState("");
  const [includeTheatrical, setIncludeTheatrical] = useState(false);
  const [pickLoading, setPickLoading] = useState(false);
  const [pickError, setPickError] = useState(null);
  const [pickResult, setPickResult] = useState(null);
  const [swapQueue, setSwapQueue] = useState([]);
  const [candidatePoolIds, setCandidatePoolIds] = useState([]);
  const [, setRefinementState] = useState(null);
  const { profile, behavioralMemory, actions: tasteActions, getPickExcludedIds } = useTasteProfile();
  const { user, maybePromptToSavePicks } = useAuth();

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
    let isCurrentRequest = true;

    if (normalizedPage === 1) {
      setLoading(true);
      setLoadingMore(false);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    const genreQuery = normalizedGenre !== "all" ? `&genre=${encodeURIComponent(normalizedGenre)}` : "";
    const runtimeQuery = normalizedRuntime !== "any" ? `&runtime=${encodeURIComponent(normalizedRuntime)}` : "";

    axios
      .get(`${API_BASE_URL}/movies?type=${normalizedView}&page=${normalizedPage}${genreQuery}${runtimeQuery}`)
      .then((response) => {
        if (!isCurrentRequest) return;
        const incomingMovies = Array.isArray(response.data.results) ? response.data.results : [];
        setMovies((currentMovies) => mergeBrowseMoviePages(currentMovies, incomingMovies, normalizedPage === 1));
        setTotalPages(response.data.total_pages || 1);
      })
      .catch((requestError) => {
        if (!isCurrentRequest) return;
        console.error("Error fetching browse library movies:", requestError);
        setError("Failed to fetch browse library movies.");
        if (normalizedPage === 1) {
          setMovies([]);
        }
      })
      .finally(() => {
        if (!isCurrentRequest) return;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [normalizedGenre, normalizedPage, normalizedRuntime, normalizedView]);

  useEffect(() => {
    setPickError(null);
    setPickResult(null);
    setSwapQueue([]);
    setCandidatePoolIds([]);
    setRefinementState(null);
  }, [includeTheatrical, normalizedGenre, normalizedMood, normalizedRuntime, normalizedView, pickPrompt]);

  const selectedMoodConfig = useMemo(
    () => MOOD_FILTERS.find((filter) => filter.id === normalizedMood) || MOOD_FILTERS[0],
    [normalizedMood]
  );

  const selectedGenreLabel = useMemo(
    () => genres.find((genre) => String(genre.id) === normalizedGenre)?.name || "All genres",
    [genres, normalizedGenre]
  );

  const suppressedMovieIds = useMemo(
    () => new Set((profile.skipped || []).map((item) => item.id).filter(Boolean)),
    [profile.skipped]
  );
  const seenMovieIds = useMemo(
    () => new Set((profile.seen || []).map((item) => item.id).filter(Boolean)),
    [profile.seen]
  );

  const filteredMovies = useMemo(
    () =>
      movies
        .filter(
          (movie) =>
            !suppressedMovieIds.has(movie.id)
            && selectedMoodConfig.predicate(movie)
            && passesSignalFloor(movie, { sourceType: normalizedView, allowReleaseSource: true, threshold: 10 })
        )
        .sort((leftMovie, rightMovie) => {
          if (!hasBehavioralSignals(behavioralMemory)) {
            return (rightMovie.popularity || 0) - (leftMovie.popularity || 0);
          }

          const leftScore = scoreMovieForBehavioralMemory(leftMovie, behavioralMemory, { surface: "browse" }).score;
          const rightScore = scoreMovieForBehavioralMemory(rightMovie, behavioralMemory, { surface: "browse" }).score;
          return ((rightMovie.popularity || 0) + rightScore) - ((leftMovie.popularity || 0) + leftScore);
        }),
    [behavioralMemory, movies, normalizedView, selectedMoodConfig, suppressedMovieIds]
  );

  const libraryRationale = useMemo(
    () => buildRecommendationRationale({ pickResult, activePick: pickResult?.primary, profile }),
    [pickResult, profile]
  );
  const libraryVibeLabel = useMemo(() => pickPrompt.trim() || selectedMoodConfig.label, [pickPrompt, selectedMoodConfig.label]);
  const queuedSwapIds = useMemo(() => swapQueue.map((movie) => movie?.id).filter(Boolean), [swapQueue]);
  const askReelbotPageContext = useMemo(() => ({
    page: "browse",
    activeFilters: {
      view: normalizedView,
      mood: normalizedMood,
      runtime: normalizedRuntime,
      genre: normalizedGenre,
    },
    visibleMovieIds: filteredMovies.slice(0, 24).map((movie) => movie.id).filter(Boolean),
    includeTheatrical,
    activeConstraints: { includeTheatrical },
  }), [filteredMovies, includeTheatrical, normalizedGenre, normalizedMood, normalizedRuntime, normalizedView]);
  useAskReelbotPageContext(askReelbotPageContext);
  useEffect(() => {
    trackProductEvent("browse_used", {
      view: normalizedView,
      mood: normalizedMood,
      runtime: normalizedRuntime,
      genre: normalizedGenre,
    });
  }, [normalizedGenre, normalizedMood, normalizedRuntime, normalizedView]);

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

    if (filterId === "theatrical") {
      setIncludeTheatrical(false);
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
      include_theatrical: includeTheatrical,
    };

    try {
      if (!options.backgroundRefill) {
        setPickLoading(true);
      }
      setPickError(null);
      if (!options.backgroundRefill) {
        void tasteActions.savePickPreferences({ ...nextPreferences, log_prompt_submission: !options.isSwap }).catch(() => {});
      }

      const response = await axios.post(
        `${API_BASE_URL}/reelbot/pick`,
        {
          ...nextPreferences,
          excluded_ids: getPickExcludedIds(nextPreferences, options.extraExcludedIds || []),
          behavioral_memory: behavioralMemory,
          refresh_key: options.refreshKey,
          trigger: "user_click",
          is_swap: Boolean(options.isSwap),
          refinement: options.refinement,
          intent_snapshot: options.intentSnapshot || ((options.isSwap || options.isRefinement) ? pickResult?.resolved_intent : undefined),
          candidate_pool_ids: options.candidatePoolIds || ((options.isSwap || options.isRefinement) ? candidatePoolIds : undefined),
        },
        {
          headers: {
            "X-ReelBot-Trigger": "user_click",
          },
        }
      );

      const normalizedPayload = normalizePickPayload(response.data, options.extraExcludedIds || []);
      if (!normalizedPayload) {
        throw new Error("No valid ReelBot pick returned.");
      }

      if (options.backgroundRefill) {
        const incomingQueue = [normalizedPayload.primary, ...((Array.isArray(normalizedPayload.alternates) ? normalizedPayload.alternates : []))];
        setCandidatePoolIds((currentIds) => (Array.isArray(normalizedPayload.candidate_pool_ids) && normalizedPayload.candidate_pool_ids.length ? normalizedPayload.candidate_pool_ids : currentIds));
        setSwapQueue((currentQueue) => {
          const mergedQueue = mergeSwapQueue(currentQueue, incomingQueue, dedupeIds([
            pickResult?.primary?.id,
            ...(options.extraExcludedIds || []),
            ...currentQueue.map((movie) => movie?.id),
          ]));
          setPickResult((currentPickResult) => currentPickResult
            ? {
                ...currentPickResult,
                alternates: mergedQueue.slice(0, 3),
                candidate_pool_ids: Array.isArray(normalizedPayload.candidate_pool_ids) && normalizedPayload.candidate_pool_ids.length
                  ? normalizedPayload.candidate_pool_ids
                  : currentPickResult.candidate_pool_ids,
              }
            : currentPickResult);
          return mergedQueue;
        });
      } else {
        setPickResult(normalizedPayload);
        setSwapQueue(buildSwapQueueFromPayload(normalizedPayload));
        setCandidatePoolIds(Array.isArray(normalizedPayload.candidate_pool_ids) ? normalizedPayload.candidate_pool_ids : []);
        setRefinementState(normalizedPayload.resolved_refinement || options.refinement || null);
        void tasteActions.recordPickResult(nextPreferences, normalizedPayload).catch(() => {});
        if (!user && !options.isSwap && !options.isRefinement) {
          maybePromptToSavePicks("after_pick");
        }
        document.getElementById("library-reelbot-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (requestError) {
      console.error("Error fetching library ReelBot pick:", requestError);
      if (!options.backgroundRefill) {
        setPickError("ReelBot could not narrow the library right now.");
      }
    } finally {
      if (!options.backgroundRefill) {
        setPickLoading(false);
      }
    }
  };

  const handleLibraryPick = async () => {
    await requestLibraryPick({ refreshKey: `browse-pick-${Date.now()}`, isSwap: false });
  };

  const handleRefreshLibraryPick = async () => {
    const swapPreferences = {
      view: normalizedView,
      mood: normalizedMood,
      runtime: normalizedRuntime,
      source: "library",
      company: "any",
      prompt: pickPrompt,
      genre: normalizedGenre,
      include_theatrical: pickResult?.resolved_preferences?.include_theatrical ?? includeTheatrical,
    };

    if (pickResult?.primary) {
      void tasteActions.recordSwapFeedback(pickResult.primary, swapPreferences).catch(() => {});
    }

    const currentDeckIds = [pickResult?.primary?.id, ...((pickResult?.alternates || []).map((movie) => movie.id)), ...queuedSwapIds].filter(Boolean);

    if (swapQueue.length) {
      const [nextPrimary, ...remainingQueue] = swapQueue;
      const promotedPayload = promoteQueuedPick(pickResult, nextPrimary, remainingQueue);
      setPickResult(promotedPayload);
      setSwapQueue(remainingQueue);
      setPickLoading(true);
      setPickError(null);
      void tasteActions.recordPickResult(swapPreferences, promotedPayload).catch(() => {});

      requestLibraryPick({
        extraExcludedIds: currentDeckIds,
        refreshKey: `browse-refill-${Date.now()}`,
        isSwap: true,
        candidatePoolIds,
        backgroundRefill: true,
      })
        .catch(() => {})
        .finally(() => {
          setPickLoading(false);
        });
      return;
    }

    await requestLibraryPick({ extraExcludedIds: currentDeckIds, refreshKey: `browse-refresh-${Date.now()}`, isSwap: true });
  };

  const handleRefineLibraryPick = async (action) => {
    if (!pickResult?.primary || !action?.id || pickLoading) {
      return;
    }

    await requestLibraryPick({
      isSwap: true,
      isRefinement: true,
      extraExcludedIds: [pickResult.primary.id],
      refreshKey: `browse-refine-${action.id}-${Date.now()}`,
      refinement: {
        id: action.id,
        label: action.label,
        source_movie_id: pickResult.primary.id,
        source_movie_title: pickResult.primary.title,
      },
      intentSnapshot: pickResult?.resolved_intent,
      candidatePoolIds,
    });
  };

  const handleStartFreshLibraryPick = () => {
    setPickPrompt("");
    setPickError(null);
    setPickResult(null);
    setSwapQueue([]);
    setCandidatePoolIds([]);
    setRefinementState(null);
  };

  const activeFilterChips = useMemo(
    () => [
      normalizedView !== "popular" ? { id: "view", label: getViewLabel(normalizedView) } : null,
      normalizedGenre !== "all" ? { id: "genre", label: selectedGenreLabel } : null,
      normalizedRuntime !== "any" ? { id: "runtime", label: PICK_RUNTIME_OPTIONS.find((option) => option.id === normalizedRuntime)?.label || "Any length" } : null,
      normalizedMood !== "all" ? { id: "mood", label: selectedMoodConfig.label } : null,
    ].filter(Boolean),
    [normalizedGenre, normalizedMood, normalizedRuntime, normalizedView, selectedGenreLabel, selectedMoodConfig.label]
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
    title: "Browse Movies | ReelBot",
    description: "Browse movies currently playing, trending, and coming soon, then ask ReelBot to narrow the choice.",
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
          </div>
        </section>

        <section id="library-filters" className="library-discovery-controls" aria-label="Browse movie filters">
          <div className="filter-group-row filter-group-row--primary">
            <div className="filter-group-head">
              <div className="detail-description-label">Browse by</div>
            </div>
            <div className="tabs browse-tabs browse-tabs--library">
              {BROWSE_VIEW_OPTIONS.map((option) => (
                <button key={option.id} type="button" className={normalizedView === option.id ? "active" : ""} onClick={() => updateFilters({ view: option.id })}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group-row">
            <div className="filter-group-head"><div className="detail-description-label">What are you in the mood for?</div></div>
            <div className="mood-chip-row">
              {MOOD_FILTERS.map((filter) => (
                <button key={filter.id} type="button" className={`mood-rail-chip${normalizedMood === filter.id ? " is-active" : ""}`} onClick={() => updateFilters({ mood: filter.id })}>
                  <span className="mood-rail-chip-label">{filter.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group-row">
            <div className="filter-group-head"><div className="detail-description-label">Genre</div></div>
            <div className="mood-chip-row">
              <button type="button" className={`mood-rail-chip${normalizedGenre === "all" ? " is-active" : ""}`} onClick={() => updateFilters({ genre: "all" })}>
                <span className="mood-rail-chip-label">All genres</span>
              </button>
              {genres.map((genre) => (
                <button key={genre.id} type="button" className={`mood-rail-chip${normalizedGenre === String(genre.id) ? " is-active" : ""}`} onClick={() => updateFilters({ genre: genre.id })} disabled={genreLoading}>
                  <span className="mood-rail-chip-label">{genre.name}</span>
                </button>
              ))}
            </div>
          </div>

          <details className="library-advanced-filters">
            <summary>Filters</summary>
            <div className="library-advanced-filters-body">
              <div className="filter-group-head"><div className="detail-description-label">Runtime</div></div>
              <div className="mood-chip-row">
                {PICK_RUNTIME_OPTIONS.map((option) => (
                  <button key={option.id} type="button" className={`mood-rail-chip${normalizedRuntime === option.id ? " is-active" : ""}`} onClick={() => updateFilters({ runtime: option.id })}>
                    <span className="mood-rail-chip-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </details>
        </section>

        <div id="library-results" className="section-header section-header--stacked-mobile library-results-head">
          <div>
            <div className="detail-description-label">Browse results</div>
            <h2 className="section-title">Library Results</h2>
          </div>
          <div className="library-results-actions">
            <div className="results-count">{filteredMovies.length} movies</div>
            <button type="button" className="browse-library-link browse-library-link--button" onClick={() => setShowReelbotPicker((current) => !current)} aria-expanded={showReelbotPicker} aria-controls="library-reelbot-picker">
              Ask ReelBot to pick one <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        <div className="browse-filter-summary-chips" aria-label="Active filters">
          {activeFilterChips.map((chip) => (
            <button key={chip.id} type="button" className="pick-summary-chip pick-summary-chip--dismissable" onClick={() => handleRemoveFilter(chip.id)} aria-label={`Remove ${chip.label}`}>
              <span>{chip.label}</span><span className="pick-summary-chip-x" aria-hidden="true">×</span>
            </button>
          ))}
        </div>

        {showReelbotPicker || pickResult?.primary || pickError || pickLoading ? (
          <section id="library-reelbot-picker" className="pick-for-me-card library-reelbot-card library-reelbot-card--inline">
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
              helperText="Optional: add a vibe if you want a more specific pick."
              suggestions={LIBRARY_PROMPTS.slice(0, 4)}
              value={pickPrompt}
              onChange={setPickPrompt}
              placeholder="Try: smart sci-fi under 2 hours, dark but rewarding, or an easy watch"
            />

            <label className="reelbot-toggle-option theatrical-toggle">
              <input
                type="checkbox"
                checked={includeTheatrical}
                onChange={(event) => setIncludeTheatrical(event.target.checked)}
                disabled={pickLoading}
              />
              <span className="reelbot-toggle-option-control" aria-hidden="true"></span>
              <span className="reelbot-toggle-option-copy">
                <span className="reelbot-toggle-option-title">Include movies still in theaters</span>
                <span className="reelbot-toggle-option-subtitle">Off by default so everything here is easy to watch at home.</span>
              </span>
            </label>

            <div className="pick-for-me-actions">
              <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={handleLibraryPick} disabled={pickLoading}>
                {pickLoading ? "Finding your pick…" : "Ask ReelBot"}
              </button>
            </div>

            <div id="library-reelbot-result">
              <PickResultPanel
                loading={pickLoading}
                error={pickError}
                rationale={libraryRationale}
                summary={null}
                primaryMovie={pickResult?.primary}
                backupMovies={pickResult?.alternates || []}
                vibeLabel={libraryVibeLabel}
                loadingCopy="Finding your pick…"
                emptyCopy="Let ReelBot choose from these filters, or add one detail."
                refreshLabel={pickLoading ? "Finding…" : "Get another pick"}
                resetLabel="Start fresh"
                backupTitle="Also worth considering"
                backupCopy="If you want another angle."
                onRefreshChoices={pickResult?.primary ? handleRefreshLibraryPick : undefined}
                onResetChoices={pickResult?.primary ? handleStartFreshLibraryPick : undefined}
                refineActions={pickResult?.primary ? LIBRARY_REFINE_ACTIONS : []}
                onRefineAction={pickResult?.primary ? handleRefineLibraryPick : undefined}
                refineStatusLabel={pickResult?.primary && pickLoading ? "Finding your pick…" : ""}
                refreshDisabled={pickLoading}
              />
            </div>
            </div>
          </section>
        ) : null}

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
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="no-poster">Poster unavailable</div>
                      )}
                    </Link>
                  </div>

                  <div className="movie-card-content">
                    <div className="movie-card-meta">
                      <span className="movie-card-chip">{getReleaseYear(movie.release_date)}</span>
                      {movie.vote_average ? <span className="movie-card-chip">TMDB {movie.vote_average.toFixed(1)}</span> : null}
                      {shouldShowAvailabilityChip(getAvailabilityStatus(movie)) ? (
                        <span className="movie-card-chip movie-card-chip--availability">{getAvailabilityStatus(movie).label}</span>
                      ) : null}
                      {seenMovieIds.has(movie.id) ? (
                        <span className="movie-card-chip movie-card-chip--seen">Seen before</span>
                      ) : null}
                    </div>

                    <h3 className="movie-card-title">
                      <Link to={getMoviePath(movie)} className="movie-title-link">
                        {movie.title}
                      </Link>
                    </h3>
                    <p className="movie-card-date">{formatMovieDate(movie.release_date)}</p>

                    <div className="movie-card-actions-row">
                      <Link to={getMoviePath(movie)} className="card-link">
                        View Details
                      </Link>
                    </div>
                  </div>
                </article>
              );})
            ) : (
              <div className="empty-state">
                <span className="status-glyph" aria-hidden="true"></span>
                <span>Nothing great matched that exactly. Try loosening one filter.</span>
              </div>
            )}
          </div>
        )}

        {normalizedPage < totalPages ? (
          <div className="browse-load-more">
            <button type="button" className="reelbot-inline-button" onClick={() => {
              if (loading || loadingMore) return;
              setLoadingMore(true);
              updateFilters({ page: normalizedPage + 1 });
            }} disabled={loading || loadingMore}>
              {loadingMore ? "Loading more…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default BrowseLibrary;
