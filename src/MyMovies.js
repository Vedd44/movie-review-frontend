import ArtworkFallback from "./components/ArtworkFallback";
import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./App.css";
import MovieCardMeta from "./components/MovieCardMeta";
import { useAuth } from "./context/AuthContext";
import useTasteProfile from "./hooks/useTasteProfile";
import { formatMovieDate, getMoviePath } from "./discovery";
import { buildBreadcrumbJsonLd, usePageMetadata } from "./seo";
import { openAskReelbot, useAskReelbotPageContext } from "./context/AskReelbotContext";

const TAB_CONFIG = [
  {
    id: "watchlist",
    label: "Saved",
    emptyTitle: "No saved movies yet.",
    emptyCopy: "Save something to come back to.",
    description: "Keep this for later.",
  },
  {
    id: "seen",
    label: "Watched",
    emptyTitle: "Nothing marked as watched yet.",
    emptyCopy: "Movies you’ve watched stay here. We’ll prioritize new discoveries, and you can still ask for a rewatch.",
    description: "Movies you’ve already watched.",
  },
  {
    id: "hidden",
    label: "Not for me",
    emptyTitle: "Nothing marked not for me.",
    emptyCopy: "Use this to avoid repeats that aren’t a fit.",
    description: "Movies ReelBot should avoid recommending again.",
  },
  {
    id: "recent",
    label: "Recent",
    emptyTitle: "No recent visits yet",
    emptyCopy: "Your latest activity.",
    description: "Your latest activity.",
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, openAuthPrompt } = useAuth();
  const { profile, actions, getMovieState, getSavedMoviesForBucket, isCloudSyncing, cloudSyncError } = useTasteProfile();
  const [libraryQuery, setLibraryQuery] = useState("");
  const activeTab = TAB_CONFIG.some((tab) => tab.id === searchParams.get("tab")) ? searchParams.get("tab") : "watchlist";
  const activeTabConfig = TAB_CONFIG.find((tab) => tab.id === activeTab) || TAB_CONFIG[0];

  const savedMovies = useMemo(
    () => getSavedMoviesForBucket(activeTab).map((movie) => normalizeSavedMovie(movie)).filter((movie) => movie.id),
    [activeTab, getSavedMoviesForBucket]
  );
  const askCandidateIds = useMemo(
    () => getSavedMoviesForBucket("watchlist").map((movie) => Number(movie?.id)).filter(Boolean),
    [getSavedMoviesForBucket]
  );
  useAskReelbotPageContext(useMemo(() => ({
    page: "my_movies",
    candidateMovieIds: askCandidateIds,
    savedMovieIds: askCandidateIds,
    watchedMovieIds: (profile.seen || []).map((movie) => Number(movie?.id)).filter(Boolean),
    rejectedMovieIds: (profile.skipped || []).map((movie) => Number(movie?.id)).filter(Boolean),
  }), [askCandidateIds, profile.seen, profile.skipped]));
  const tasteSummary = useMemo(() => {
    const allMovies = [
      ...(profile.watchlist || []),
      ...(profile.seen || []),

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
    title: "My movies | ReelBot",
    description: user ? "Saved, seen, and hidden picks in one place." : "Sign in to see your saved picks and recent activity in ReelBot.",
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
    <div className="browse-page my-movies-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo my-movies-hero">
          <div className="browse-copy">
            <h1 className="browse-title">My movies</h1>
            {user ? <p className="browse-subtitle browse-subtitle--hero">Good movies deserve a place to come back to.</p> : null}
            {user && (askCandidateIds.length || profile.seen.length) ? (
              <button type="button" className="reelbot-inline-button reelbot-inline-button--solid my-movies-pick-action" onClick={() => openAskReelbot({ prompt: activeTab === "seen" || !askCandidateIds.length ? "Choose a movie from Watched to rewatch" : "choose a movie from my saved list that I have not watched" })}>
                {activeTab === "seen" || !askCandidateIds.length ? "Pick a rewatch" : "Pick from my movies"}
              </button>
            ) : null}
          </div>
          {user && tasteSummary.length ? (
            <aside className="my-movies-taste-summary" aria-label="Your taste">
              <span className="my-movies-taste-label">Your taste</span>
              <div className="my-movies-taste-values">
                {tasteSummary.map((item) => <span key={item}>{item}</span>)}
              </div>
            </aside>
          ) : null}
        </section>

        {!user ? (
          <section className="my-movies-empty-gate">
            <div className="my-movies-gate-copy">
              <h2 className="section-title">Sign in to see your movies</h2>
              <p className="section-subtitle">Save movies, track what you’ve watched, and keep them synced across devices.</p>
            </div>
            <div className="my-movies-gate-actions">
              <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={() => openAuthPrompt("my_movies_gate")}>Sign in</button>
              <Link to="/browse" className="reelbot-inline-button my-movies-browse-action">Browse movies</Link>
            </div>
          </section>
        ) : null}


        {user ? (
        <section className="saved-movies-shell detail-info-card">
          {isCloudSyncing ? <p className="saved-movies-sync-status" role="status">Saving your changes…</p> : null}
          {cloudSyncError ? <p className="error-message my-movies-sync-error">{cloudSyncError}</p> : null}

          <div className="tabs saved-movie-tabs" role="group" aria-label="Saved movie lists">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "active" : ""}
                aria-pressed={activeTab === tab.id}
                onClick={() => setSearchParams({ tab: tab.id })}
              >
                {tab.label} <span className="rb-tab-count">{getSavedMoviesForBucket(tab.id).length}</span>
              </button>
            ))}
          </div>

          <div className="saved-movies-tab-copy">
            <div>
              <p className="detail-secondary-text">{activeTabConfig.description}</p>
            </div>
            <label className="rb-library-search"><span className="sr-only">Search your movies</span><input type="search" aria-label="Search your movies" placeholder="Find in your movies" value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} /></label>
          </div>

          {savedMovies.length && !savedMovies.some(movie => movie.title.toLowerCase().includes(libraryQuery.trim().toLowerCase())) ? <div className="empty-state"><h3>No movies match “{libraryQuery}”</h3><button className="rb-text-button" onClick={() => setLibraryQuery("")}>Clear search</button></div> : null}
          {savedMovies.length ? (
            <div className="movie-list saved-movie-list">
              {savedMovies.filter(movie => movie.title.toLowerCase().includes(libraryQuery.trim().toLowerCase())).map((movie) => {
                const movieState = getMovieState(movie.id);
                return (
                <article key={`${activeTab}-${movie.id}`} className="movie-card saved-movie-card">
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
                      <ArtworkFallback className="no-poster" />
                    )}
                  </Link>

                  <div className="movie-card-content saved-movie-card-content">
                    <MovieCardMeta movie={movie}>
                    </MovieCardMeta>

                    <h3 className="movie-card-title">
                      <Link to={getMoviePath(movie)} className="movie-title-link">
                        {movie.title}
                      </Link>
                    </h3>
                    {movie.release_date > new Date().toISOString().slice(0, 10) ? <p className="movie-card-date">{formatMovieDate(movie.release_date)}</p> : null}
                    <p className="saved-movie-note">{getSavedMetaLabel(activeTab, movie)}</p>


                    <div className="saved-movie-actions">
                      <Link to={getMoviePath(movie)} className="card-link saved-movie-open-link">
                        Open details
                      </Link>
                      <details className="saved-movie-status-menu">
                        <summary><span>Manage</span><span className="saved-movie-status-chevron" aria-hidden="true">⌄</span></summary>
                        <div className="saved-movie-status-popover">
                          <span className="saved-movie-status-heading">Movie status</span>
                          {[
                            { label: activeTab === "recent" ? "Save" : "Saved", active: movieState.inWatchlist, toggle: actions.toggleWatchlist },
                            { label: "Watched", active: movieState.seen, toggle: actions.toggleSeen },
                            { label: "Not for me", active: movieState.skipped, toggle: actions.toggleSkipped },
                          ].map(({ label, active, toggle }) => (
                            <button
                              key={label}
                              type="button"
                              className={active ? "is-active" : ""}
                              aria-pressed={active}
                              onClick={() => {
                                // The shared profile rolls back and displays failed saves above.
                                toggle(movie).catch(() => {});
                              }}
                            >
                              <span>{label}</span>
                              <span aria-hidden="true">{active ? "✓" : ""}</span>
                            </button>
                          ))}
                        </div>
                      </details>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state saved-movie-empty-state">
              <span className="status-glyph" aria-hidden="true"></span>
                <div>
                  <strong>{activeTabConfig.emptyTitle}</strong>
                  <p>{activeTabConfig.emptyCopy}</p>
                  <div className="saved-empty-actions">
                    <Link to="/browse" className="card-link">Browse Movies</Link>
                    <Link to="/#pick-for-me" className="reelbot-inline-button">Get a pick</Link>
                  </div>
                </div>
              </div>
          )}
        </section>
        ) : null}
      </div>
    </div>
  );
}

export default MyMovies;
