import React, { useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./App.css";
import TasteActionBar from "./components/TasteActionBar";
import { useAuth } from "./context/AuthContext";
import useTasteProfile from "./hooks/useTasteProfile";
import { formatMovieDate, getMoviePath, getReleaseYear } from "./discovery";
import { buildBreadcrumbJsonLd, usePageMetadata } from "./seo";

const TAB_CONFIG = [
  {
    id: "watchlist",
    label: "Saved",
    emptyTitle: "Nothing saved yet",
    emptyCopy: "Save keeps a movie around for later so ReelBot can leave it in your mix.",
    description: "Saved means keep this around for a future night.",
  },
  {
    id: "seen",
    label: "Seen",
    emptyTitle: "Nothing marked Seen yet",
    emptyCopy: "Seen tells ReelBot you already watched it, so it can stay out of future picks.",
    description: "Seen means you watched it and ReelBot should stop resurfacing it.",
  },
  {
    id: "hidden",
    label: "Hidden",
    emptyTitle: "Nothing hidden yet",
    emptyCopy: "Hidden tells ReelBot not to show it again in this browser.",
    description: "Hidden means don’t show this again in future picks.",
  },
  {
    id: "recent",
    label: "Recent",
    emptyTitle: "No recent visits yet",
    emptyCopy: "Open a movie page and it will show up here for quick backtracking.",
    description: "Recent gives you a fast way back to the movies you were just checking.",
  },
];

const getSavedMetaLabel = (tabId, movie) => {
  const savedDate = movie?.saved_at ? new Date(movie.saved_at) : null;
  const timestampLabel = savedDate && !Number.isNaN(savedDate.getTime())
    ? savedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  switch (tabId) {
    case "watchlist":
      return timestampLabel ? `Saved ${timestampLabel}` : "Saved for later";
    case "seen":
      return timestampLabel ? `Marked seen ${timestampLabel}` : "Marked seen";
    case "hidden":
      return timestampLabel ? `Hidden ${timestampLabel}` : "Hidden from picks";
    default:
      return timestampLabel ? `Viewed ${timestampLabel}` : "Recently viewed";
  }
};

const normalizeSavedMovie = (movie = {}) => ({
  id: Number(movie?.id || 0) || null,
  title: String(movie?.title || "").trim() || "Saved movie",
  poster_path: movie?.poster_path || null,
  release_date: movie?.release_date || "",
  vote_average: Number(movie?.vote_average || 0) || 0,
  overview: movie?.overview || "",
  saved_at: movie?.saved_at || null,
});

function MyMovies() {
  const autoPromptedRef = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, openAuthPrompt } = useAuth();
  const { profile, getSavedMoviesForBucket, savedCounts, isCloudSyncing, cloudSyncError, isUsingCloudProfile } = useTasteProfile();
  const activeTab = TAB_CONFIG.some((tab) => tab.id === searchParams.get("tab")) ? searchParams.get("tab") : "watchlist";
  const activeTabConfig = TAB_CONFIG.find((tab) => tab.id === activeTab) || TAB_CONFIG[0];

  const savedMovies = useMemo(
    () => getSavedMoviesForBucket(activeTab).map((movie) => normalizeSavedMovie(movie)).filter((movie) => movie.id),
    [activeTab, getSavedMoviesForBucket]
  );
  const totalSavedMovies = useMemo(
    () => savedCounts.watchlist + savedCounts.seen + savedCounts.hidden + savedCounts.recent,
    [savedCounts.hidden, savedCounts.recent, savedCounts.seen, savedCounts.watchlist]
  );

  const tasteSummary = useMemo(() => {
    const allMovies = [
      ...(profile.watchlist || []),
      ...(profile.seen || []),
      ...(profile.skipped || []),
    ];
    const genreCounts = new Map();
    allMovies.forEach((movie) => {
      (movie.genre_names || []).forEach((genre) => {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      });
    });

    const topGenres = Array.from(genreCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([genre]) => genre);

    const vibeLabels = (profile.likedVibes || []).map((item) => item.label).filter(Boolean).slice(0, 2);
    const lastPick = profile.lastPickPreferences || {};
    const runtimeLabel = lastPick.runtime === "under_two_hours"
      ? "90–120 min picks"
      : lastPick.runtime === "over_two_hours"
        ? "Longer sit-down watches"
        : "";

    return [
      ...topGenres,
      ...vibeLabels,
      runtimeLabel,
    ].filter(Boolean).slice(0, 5);
  }, [profile]);

  usePageMetadata({
    title: "My Movies | ReelBot",
    description: user ? "Your saved ReelBot picks, seen titles, hidden movies, and recent activity." : "Your saved ReelBot picks, seen titles, and hidden movies in this browser.",
    path: "/my-movies",
    robots: "noindex,follow",
    structuredData: [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "My Movies", path: "/my-movies" },
      ]),
    ],
  });

  useEffect(() => {
    if (user || totalSavedMovies > 0 || autoPromptedRef.current) {
      return;
    }

    autoPromptedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      openAuthPrompt("my_movies_empty");
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [openAuthPrompt, totalSavedMovies, user]);

  return (
    <div className="browse-page my-movies-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo">
          <div className="browse-copy">
            <div className="browse-kicker">My Movies</div>
            <h1 className="browse-title">Your ReelBot memory</h1>
            <p className="browse-subtitle browse-subtitle--hero">
              {user
                ? "Your saved, seen, hidden, and recent movie memory lives with your ReelBot account."
                : "Save movies for later, mark what you have seen, and hide what you do not want ReelBot to surface again."}
            </p>
            {user ? <p className="my-movies-synced-note">Your picks are saved and synced across devices.</p> : null}
          </div>
        </section>

        {tasteSummary.length ? (
          <section className="detail-info-card my-movies-taste-card">
            <div className="section-header section-header--stacked-mobile section-header--compact">
              <div>
                <div className="detail-description-label">Your taste so far</div>
                <h2 className="section-title">What ReelBot is learning</h2>
                <p className="section-subtitle">A quick read from your saved, seen, hidden, and vibe interactions on this browser.</p>
              </div>
            </div>
            <div className="taste-learning-chips">
              {tasteSummary.map((item) => (
                <span key={item} className="pick-summary-chip">{item}</span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="saved-movies-shell detail-info-card">
          <div className="section-header section-header--stacked-mobile section-header--compact">
            <div>
              <h2 className="section-title">Your movie lists</h2>
              <p className="section-subtitle">Save = keep for later. Seen = remove from future picks. Hidden = don’t show again.</p>
            </div>
            <div className="saved-movies-count-row">
              <span className="results-count results-count--context">{isUsingCloudProfile ? "Synced to your account" : "Saved in this browser"}</span>
              <span className="results-count results-count--context">{savedCounts.watchlist} saved</span>
              <span className="results-count results-count--context">{savedCounts.seen} seen</span>
              <span className="results-count results-count--context">{savedCounts.hidden} hidden</span>
              {isCloudSyncing ? <span className="results-count results-count--context">Saving…</span> : null}
            </div>
          </div>
          {cloudSyncError ? <p className="error-message my-movies-sync-error">{cloudSyncError}</p> : null}

          <div className="tabs saved-movie-tabs" role="tablist" aria-label="Saved movie lists">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setSearchParams({ tab: tab.id })}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="saved-movies-tab-copy">
            <div>
              <div className="detail-description-label">{activeTabConfig.label}</div>
              <p className="detail-secondary-text">{activeTabConfig.description}</p>
            </div>
            <div className="results-count">{savedMovies.length} titles</div>
          </div>

          {savedMovies.length ? (
            <div className="movie-list saved-movie-list">
              {savedMovies.map((movie) => (
                <article key={`${activeTab}-${movie.id}`} className="movie-card saved-movie-card">
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

                  <div className="movie-card-content saved-movie-card-content">
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
                    <p className="saved-movie-note">{getSavedMetaLabel(activeTab, movie)}</p>
                    {movie.overview ? <p className="saved-movie-overview">{movie.overview}</p> : null}

                    <div className="saved-movie-actions">
                      <Link to={getMoviePath(movie)} className="card-link saved-movie-open-link">
                        Open details
                      </Link>
                      <TasteActionBar movie={movie} compact className="saved-movie-taste-actions" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state saved-movie-empty-state">
              <span className="status-glyph" aria-hidden="true"></span>
                <div>
                  <strong>{!user && totalSavedMovies === 0 ? "Save your picks to access them anytime" : activeTabConfig.emptyTitle}</strong>
                  <p>{!user && totalSavedMovies === 0 ? "Enter your email once and your picks, history, and preferences will stay with you across devices." : activeTabConfig.emptyCopy}</p>
                  <div className="saved-empty-actions">
                    {!user && totalSavedMovies === 0 ? (
                      <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={() => openAuthPrompt("my_movies_cta")}>
                        Save your picks
                      </button>
                    ) : null}
                    <Link to="/browse" className="card-link">Browse Movies</Link>
                    <Link to="/#pick-for-me" className="reelbot-inline-button">Get a Pick</Link>
                  </div>
                </div>
              </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default MyMovies;
