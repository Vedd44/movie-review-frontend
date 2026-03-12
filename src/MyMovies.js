import React, { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./App.css";
import TasteActionBar from "./components/TasteActionBar";
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

function MyMovies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, getSavedMoviesForBucket, savedCounts } = useTasteProfile();
  const activeTab = TAB_CONFIG.some((tab) => tab.id === searchParams.get("tab")) ? searchParams.get("tab") : "watchlist";
  const activeTabConfig = TAB_CONFIG.find((tab) => tab.id === activeTab) || TAB_CONFIG[0];

  const savedMovies = useMemo(() => getSavedMoviesForBucket(activeTab), [activeTab, getSavedMoviesForBucket]);

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
    description: "Your saved ReelBot picks, seen titles, and hidden movies in this browser.",
    path: "/my-movies",
    robots: "noindex,follow",
    structuredData: [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "My Movies", path: "/my-movies" },
      ]),
    ],
  });

  return (
    <div className="browse-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo">
          <div className="browse-copy">
            <div className="browse-kicker">My Movies</div>
            <h1 className="browse-title">Your ReelBot memory</h1>
            <p className="browse-subtitle browse-subtitle--hero">
              Save movies for later, mark what you have seen, and hide what you do not want ReelBot to surface again.
            </p>
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
              <span className="results-count results-count--context">{savedCounts.watchlist} saved</span>
              <span className="results-count results-count--context">{savedCounts.seen} seen</span>
              <span className="results-count results-count--context">{savedCounts.hidden} hidden</span>
            </div>
          </div>

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
                      <Link to={getMoviePath(movie)} className="card-link">
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
                <strong>{activeTabConfig.emptyTitle}</strong>
                <p>{activeTabConfig.emptyCopy}</p>
                <div className="saved-empty-actions">
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
