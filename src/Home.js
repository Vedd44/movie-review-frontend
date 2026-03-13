import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./App.css";
import {
  API_BASE_URL,
  DISCOVERY_PROMPT_SETS,
  MOOD_FILTERS,
  REELBOT_CAPABILITIES,
  VIEW_OPTIONS,
  formatMovieDate,
  getFeedPath,
  getReleaseYear,
  getViewLabel,
  getMoviePath,
} from "./discovery";
import PickResultPanel from "./components/PickResultPanel";
import ReelbotPromptComposer from "./components/ReelbotPromptComposer";
import useTasteProfile from "./hooks/useTasteProfile";
import { buildRecommendationRationale, getBackupRoleLabel } from "./recommendationInsights";
import { buildBreadcrumbJsonLd, buildItemListJsonLd, usePageMetadata } from "./seo";
import { buildAbsoluteUrl, DEFAULT_SOCIAL_IMAGE, SITE_DESCRIPTION, SITE_NAME } from "./siteConfig";

const PICK_LOADING_MESSAGES = [
  "Scanning the library…",
  "Evaluating candidates…",
  "Ranking the best match…",
];

const FEED_METADATA = {
  latest: {
    title: "Now Playing Movies | ReelBot",
    description: "See what’s in theaters now, then let ReelBot help narrow the best pick.",
    path: "/now-playing",
    heading: "Now Playing",
  },
  popular: {
    title: "Trending Movies | ReelBot",
    description: "Browse trending movie picks, then use ReelBot to narrow what to watch next.",
    path: "/trending",
    heading: "Trending This Week",
  },
  upcoming: {
    title: "Coming Soon Movies | ReelBot",
    description: "See upcoming releases and use ReelBot to track what’s worth watching next.",
    path: "/coming-soon",
    heading: "Coming Soon",
  },
};

const shuffleArray = (items = []) => {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[randomIndex]] = [nextItems[randomIndex], nextItems[index]];
  }

  return nextItems;
};

function Home({ routeView = "latest", isFeedRoute = false }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movieType, setMovieType] = useState(routeView);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedMood, setSelectedMood] = useState("all");
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [pickPrompt, setPickPrompt] = useState("");
  const [activePromptSuggestion, setActivePromptSuggestion] = useState("");
  const [pickLoading, setPickLoading] = useState(false);
  const [pickError, setPickError] = useState(null);
  const [pickValidation, setPickValidation] = useState("");
  const [pickResult, setPickResult] = useState(null);
  const [lastPickMode, setLastPickMode] = useState("prompt");
  const [isCompactHeroPreview, setIsCompactHeroPreview] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 560px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 560px)");
    const handleChange = (event) => setIsCompactHeroPreview(event.matches);

    setIsCompactHeroPreview(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [visiblePromptSuggestions] = useState(() => {
    const randomizedSets = shuffleArray(DISCOVERY_PROMPT_SETS);
    return randomizedSets[0] || [];
  });
  const { profile, actions: tasteActions, getPickExcludedIds } = useTasteProfile();

  const scrollToSection = (id) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  useEffect(() => {
    setMovieType(routeView);
    setCurrentPage(1);
  }, [routeView]);

  useEffect(() => {
    if (isFeedRoute) {
      const timeoutId = window.setTimeout(() => {
        document.getElementById("movie-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [isFeedRoute, location.pathname]);

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
    setPickValidation("");
    setPickResult(null);
  }, [movieType, pickPrompt]);

  useEffect(() => {
    if (!pickLoading) {
      setLoadingMessageIndex(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setLoadingMessageIndex((currentIndex) => (currentIndex + 1) % PICK_LOADING_MESSAGES.length);
    }, 1400);

    return () => window.clearInterval(intervalId);
  }, [pickLoading]);

  const handleViewChange = (view) => {
    setCurrentPage(1);
    navigate(getFeedPath(view));
  };

  const handleExploreMoodChange = (moodId) => {
    setSelectedMood(moodId);
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
    return source.slice(0, isCompactHeroPreview ? 4 : 3);
  }, [filteredMovies, isCompactHeroPreview, visibleMovies]);

  const viewLabel = getViewLabel(movieType);
  const heading = FEED_METADATA[movieType]?.heading || getViewLabel(movieType);

  const sectionSubtitle = useMemo(() => {
    if (selectedMood !== "all") {
      return `${selectedMoodConfig.label} picks from this ${viewLabel.toLowerCase()} lineup.`;
    }

    if (movieType === "popular") {
      return "A look at what is trending this week.";
    }

    if (movieType === "upcoming") {
      return "A look at what's arriving soon.";
    }

    return "What’s currently in theaters.";
  }, [movieType, selectedMood, selectedMoodConfig.label, viewLabel]);

  const feedCountLabel = selectedMood === "all" ? `${filteredMovies.length} titles` : `${filteredMovies.length} matches on this page`;
  const heroPreviewLabel = movieType === "upcoming" ? "Coming soon" : movieType === "popular" ? "Trending this week" : "Now playing";
  const browseLibraryPath = `/browse${selectedMood !== "all" ? `?mood=${selectedMood}` : ""}`;
  const browseLibraryResultsPath = `${browseLibraryPath}${browseLibraryPath.includes("?") ? "&" : "?"}view=${movieType}#library-results`;
  const activePick = pickResult?.primary || null;
  const backupPicks = useMemo(() => pickResult?.alternates || [], [pickResult]);
  const recommendationRationale = useMemo(
    () => buildRecommendationRationale({ pickResult, activePick, profile, surpriseMode: lastPickMode === "surprise" }),
    [pickResult, activePick, profile, lastPickMode]
  );
  const backupPicksWithRoles = useMemo(
    () => backupPicks.map((movie, index) => ({ ...movie, backupRole: movie.backupRole || getBackupRoleLabel(movie, index) })),
    [backupPicks]
  );

  const homeStructuredData = useMemo(() => {
    if (isFeedRoute) {
      return [
        buildBreadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: heading, path: FEED_METADATA[movieType]?.path || "/now-playing" },
        ]),
        filteredMovies.length
          ? buildItemListJsonLd(
              filteredMovies.slice(0, 12).map((movie) => ({
                name: movie.title,
                path: getMoviePath(movie),
              }))
            )
          : null,
      ].filter(Boolean);
    }

    return [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: buildAbsoluteUrl("/"),
        logo: buildAbsoluteUrl("/logo512.png"),
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: buildAbsoluteUrl("/"),
        potentialAction: {
          "@type": "SearchAction",
          target: `${buildAbsoluteUrl("/search")}?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: SITE_NAME,
        url: buildAbsoluteUrl("/"),
        applicationCategory: "EntertainmentApplication",
        operatingSystem: "Web",
        description: "AI movie recommendation companion for quick picks, spoiler-light takes, review splits, and better next-watch decisions.",
      },
      buildBreadcrumbJsonLd([{ name: "Home", path: "/" }]),
    ];
  }, [filteredMovies, heading, isFeedRoute, movieType]);

  usePageMetadata(
    isFeedRoute
      ? {
          title: FEED_METADATA[movieType]?.title || "Now Playing Movies | ReelBot",
          description: FEED_METADATA[movieType]?.description || SITE_DESCRIPTION,
          path: FEED_METADATA[movieType]?.path || "/now-playing",
          structuredData: homeStructuredData,
        }
      : {
          title: "ReelBot — AI Movie Picker | Find What to Watch Tonight",
          description:
            "Find what to watch tonight with ReelBot — an AI-powered movie picker that delivers fast recommendations, spoiler-light insights, and smarter next-watch suggestions.",
          path: "/",
          image: DEFAULT_SOCIAL_IMAGE,
          structuredData: homeStructuredData,
        }
  );

  const pickVibeLabel = useMemo(() => pickPrompt.trim(), [pickPrompt]);

  const requestPick = async (nextPreferences, options = {}) => {
    try {
      setPickLoading(true);
      setPickError(null);
      setPickValidation("");
      tasteActions.savePickPreferences(nextPreferences);

      const requestPayload = {
        ...nextPreferences,
        excluded_ids: getPickExcludedIds(nextPreferences, options.extraExcludedIds || []),
        trigger: "user_click",
      };

      if (options.intentSnapshot || pickResult?.resolved_intent) {
        requestPayload.intent_snapshot = options.intentSnapshot || pickResult?.resolved_intent;
      }

      if (options.candidatePoolIds || pickResult?.candidate_pool_ids) {
        requestPayload.candidate_pool_ids = options.candidatePoolIds || pickResult?.candidate_pool_ids;
      }

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
    const nextPreferences = {
      view: movieType,
      mood: "all",
      runtime: "any",
      source: "feed",
      company: "any",
      prompt: pickPrompt,
      ...overrides,
    };

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
    if (!pickPrompt.trim()) {
      setPickValidation("Enter a vibe or choose Surprise Me.");
      return;
    }

    setLastPickMode("prompt");
    await submitPick({}, { scrollToResults: true });
  };

  const handleSurprisePick = async () => {
    setPickValidation("");
    setLastPickMode("surprise");
    await submitPick(
      {
        prompt: "",
        source: "library",
      },
      {
        scrollToResults: true,
        refreshKey: `surprise-${Date.now()}`,
      }
    );
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
    <div className="browse-page home-page">
      <div className="container browse-shell home-shell">
        <section className="browse-hero browse-hero--compact browse-hero--with-search">
          <div className="browse-copy">
            <div className="browse-kicker">ReelBot</div>
            <h1 className="browse-title browse-title--brand">What should I watch tonight?</h1>
            <div className="browse-powered">Fast feeds. Better picks. Less second-guessing.</div>
            <p className="browse-subtitle browse-subtitle--hero">
              Tell ReelBot the vibe and get a fast, confident pick.
              <span className="browse-subtitle-break">Browse if you want to widen the search.</span>
            </p>
            <div className="hero-trust-signal">Powered by TMDB data and AI recommendations.</div>

            <div className="browse-hero-actions">
              <a href="#pick-for-me" className="reelbot-inline-button reelbot-inline-button--solid">
                Get a Pick
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
              <h2 className="section-title">Find Your Next Watch</h2>
              <p className="section-subtitle">Describe the vibe, or tap a prompt to get started.</p>
            </div>
          </div>

          <ReelbotPromptComposer
            suggestions={visiblePromptSuggestions}
            activeSuggestion={activePromptSuggestion}
            value={pickPrompt}
            onSuggestionSelect={(value) => {
              setPickPrompt(value);
              setActivePromptSuggestion(value);
              if (pickValidation) {
                setPickValidation("");
              }
            }}
            onInputChange={(value) => {
              setPickPrompt(value);
              if (activePromptSuggestion && value.trim() !== activePromptSuggestion) {
                setActivePromptSuggestion("");
              }
              if (pickValidation) {
                setPickValidation("");
              }
            }}
            placeholder="fun date night movie, something tense but not depressing, smart sci-fi, easy watch comedy"
            errorText={pickValidation}
          />

          <div className="pick-for-me-actions">
            <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={handlePickSubmit} disabled={pickLoading}>
              {pickLoading && lastPickMode === "prompt" ? "Finding a Movie…" : "Find a Movie"}
            </button>
            <button type="button" className="reelbot-inline-button reelbot-inline-button--secondary" onClick={handleSurprisePick} disabled={pickLoading}>
              {pickLoading && lastPickMode === "surprise" ? "Surprising You…" : "Surprise Me"}
            </button>
          </div>
        </section>

        <section id="pick-result" className="pick-result-section" aria-live="polite">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <h2 className="section-title">{activePick ? "Your Pick" : "Your pick lands here"}</h2>
              <p className="section-subtitle">
                {activePick
                  ? "A strong first pick, with a few nearby alternatives."
                  : "Tell ReelBot the vibe and it will line up a confident first pick and a few nearby alternatives."}
              </p>
            </div>
          </div>

          <PickResultPanel
            loading={pickLoading}
            error={pickError}
            rationale={recommendationRationale}
            summary={recommendationRationale?.summaryLine || pickResult?.summary}
            primaryMovie={activePick}
            backupMovies={backupPicksWithRoles}
            vibeLabel={pickVibeLabel}
            loadingCopy={PICK_LOADING_MESSAGES[loadingMessageIndex] || "Evaluating candidates…"}
            emptyCopy="Tell ReelBot the vibe and it will line up a confident first pick and a few nearby alternatives."
            refreshLabel="Swap Pick"
            backupTitle="Other good options"
            onRefreshChoices={pickResult?.primary ? handleRefreshPick : undefined}
            refreshDisabled={pickLoading}
            showExpandedReasoning
          />
        </section>

        <div className="mode-divider" aria-hidden="true">
          <span className="mode-divider-line"></span>
          <span className="mode-divider-label">Explore Mode</span>
          <span className="mode-divider-line"></span>
        </div>

        <section className="explore-mode-shell">
          <div className="section-header section-header--compact section-header--stacked-mobile explore-mode-header">
            <div>
              <div className="detail-description-label">Explore</div>
              <h2 className="section-title">Explore Movies</h2>
              <p className="section-subtitle">Prefer browsing? Scan what’s in theaters, trending, or coming soon.</p>
            </div>
          </div>

          <section className="secondary-discovery-section">
            <div className="secondary-discovery-grid">
              <aside className="browse-library-card browse-library-card--secondary">
                <div className="detail-description-label">Browse Library</div>
                <h3 className="browse-library-title">Need a wider search?</h3>
                <p className="detail-secondary-text browse-library-copy">
                  Use Browse Library when you want more control over genre, runtime, and mood.
                </p>

                <div className="browse-library-links">
                  <Link to="/browse?view=popular&genre=878#library-results" className="browse-library-link">
                    Trending Sci-Fi
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

                <Link to="/browse" className="card-link browse-library-cta">
                  Browse Movies
                </Link>
              </aside>
            </div>
          </section>

          <div id="movie-grid" className="section-header section-header--stacked-mobile">
            <div>
              <h2 className="section-title">{heading}</h2>
              <p className="section-subtitle">{sectionSubtitle}</p>
              <div className="feed-showing-label">Showing: {selectedMood === "all" ? viewLabel : selectedMoodConfig.label}</div>
            </div>
            <div className="results-count">{feedCountLabel}</div>
          </div>

          <div className="tabs browse-tabs browse-tabs--secondary">
            {VIEW_OPTIONS.map((option) => (
              <button key={option.id} className={movieType === option.id ? "active" : ""} onClick={() => handleViewChange(option.id)}>
                {option.label}
              </button>
            ))}
          </div>

          <div className="mood-rail mood-rail--secondary mood-rail--grid" aria-label="Filter poster grid by mood">
            {MOOD_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`mood-rail-chip${selectedMood === filter.id ? " is-active" : ""}`}
                onClick={() => handleExploreMoodChange(filter.id)}
                title={filter.hint}
                aria-pressed={selectedMood === filter.id}
              >
                <span className="mood-rail-chip-label">{filter.label}</span>
              </button>
            ))}
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
            <div className="movie-list home-poster-grid">
              {filteredMovies.length > 0 ? (
                filteredMovies.map((movie) => (
                  <article key={movie.id} className="movie-card home-movie-card">
                    <Link to={getMoviePath(movie)} className="home-movie-card-link" aria-label={`Open ${movie.title}`}>
                      {movie.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                          alt={movie.title}
                          className="movie-poster"
                        />
                      ) : (
                        <div className="no-poster">Poster unavailable</div>
                      )}

                      <div className="movie-card-content">
                        <div className="movie-card-meta">
                          <span className="movie-card-chip">{getReleaseYear(movie.release_date)}</span>
                          {movie.vote_average ? <span className="movie-card-chip">TMDB {movie.vote_average.toFixed(1)}</span> : null}
                        </div>

                        <h3 className="movie-card-title">{movie.title}</h3>
                        <p className="movie-card-date">{formatMovieDate(movie.release_date)}</p>
                      </div>
                    </Link>
                  </article>
                ))
              ) : (
                <div className="empty-state feed-empty-state">
                  <span className="status-glyph" aria-hidden="true"></span>
                  <span>{selectedMood === "all" ? "Nothing is landing in this feed right now." : "Nothing in this feed fits that mood right now."}</span>
                  <Link to={browseLibraryResultsPath} className="card-link">
                    Browse Movies
                  </Link>
                </div>
              )}
            </div>

            {selectedMood !== "all" && filteredMovies.length > 0 && filteredMovies.length < 8 ? (
              <div className="feed-followup-card">
                <div>
                  <div className="detail-description-label">Want more {selectedMoodConfig.label.toLowerCase()} picks?</div>
                  <p className="detail-secondary-text">
                    This homepage feed is just a slice of the lineup. Browse Library goes wider when you want more options.
                  </p>
                </div>
                <Link to={browseLibraryResultsPath} className="card-link">
                  Browse Movies
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
        </section>
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
