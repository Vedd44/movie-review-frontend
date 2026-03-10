import React, { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./App.css";
import TasteActionBar from "./components/TasteActionBar";
import useTasteProfile from "./hooks/useTasteProfile";
import { formatMovieDate, getMoviePath, getReleaseYear } from "./discovery";

const TAB_CONFIG = [
  {
    id: "watchlist",
    label: "Watchlist",
    emptyTitle: "Your Watchlist is still open",
    emptyCopy: "Save a movie from any card or detail page and it will show up here.",
    description: "Movies you want to keep in the mix for a future night.",
  },
  {
    id: "seen",
    label: "Seen",
    emptyTitle: "Nothing marked Seen yet",
    emptyCopy: "When you finish something, mark it Seen so your list stays honest.",
    description: "Titles you have already crossed off.",
  },
  {
    id: "hidden",
    label: "Hidden",
    emptyTitle: "Nothing hidden yet",
    emptyCopy: "Use Not for Me when you want a title to stay out of the way for future picks.",
    description: "Titles ReelBot should keep out of future picks for this browser.",
  },
  {
    id: "recent",
    label: "Recent",
    emptyTitle: "No recent views yet",
    emptyCopy: "Open a movie detail page and it will show up here for quick backtracking.",
    description: "Quick access to the last movies you opened.",
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
  const { getSavedMoviesForBucket, savedCounts } = useTasteProfile();
  const activeTab = TAB_CONFIG.some((tab) => tab.id === searchParams.get("tab")) ? searchParams.get("tab") : "watchlist";
  const activeTabConfig = TAB_CONFIG.find((tab) => tab.id === activeTab) || TAB_CONFIG[0];

  const savedMovies = useMemo(() => getSavedMoviesForBucket(activeTab), [activeTab, getSavedMoviesForBucket]);

  return (
    <div className="browse-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo">
          <div className="browse-copy">
            <div className="browse-kicker">My Movies</div>
            <h1 className="browse-title">Your saved ReelBot picks</h1>
            <p className="browse-subtitle browse-subtitle--hero">
              Everything here is saved locally in this browser. Mark something for later, track what you have seen, or hide titles you do not want ReelBot surfacing again.
            </p>
          </div>
        </section>

        <section className="saved-movies-shell detail-info-card">
          <div className="section-header section-header--stacked-mobile section-header--compact">
            <div>
              <h2 className="section-title">Your movie memory</h2>
              <p className="section-subtitle">Marking a title Seen removes it from Watchlist. Hiding a title keeps it out of future ReelBot picks on this browser.</p>
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
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default MyMovies;
