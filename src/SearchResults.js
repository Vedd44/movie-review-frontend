import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import ProviderBadgeRow from "./components/ProviderBadgeRow";
import { API_BASE_URL, formatMovieDate, getMoviePath, getReleaseYear } from "./discovery";
import { rankSearchResults } from "./movieSignals";
import { buildBreadcrumbJsonLd, buildItemListJsonLd, usePageMetadata } from "./seo";
import useWatchProviderBadges from "./hooks/useWatchProviderBadges";

function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") || "";
  const [draftQuery, setDraftQuery] = useState(searchQuery);
  const [searchPayload, setSearchPayload] = useState({ results: [], top_match: null, related_results: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDraftQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!searchQuery) {
      setError("No search query provided.");
      setSearchPayload({ results: [], top_match: null, related_results: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    axios
      .get(`${API_BASE_URL}/search?query=${encodeURIComponent(searchQuery)}`)
      .then((response) => {
        setSearchPayload({
          results: response.data.results || [],
          top_match: response.data.top_match || null,
          related_results: response.data.related_results || [],
        });
        setError(null);
      })
      .catch((requestError) => {
        console.error("❌ Error fetching search results:", requestError);
        setError("Failed to fetch search results.");
        setSearchPayload({ results: [], top_match: null, related_results: [] });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchQuery]);

  const rankedMovies = useMemo(
    () => (searchPayload.results?.length ? searchPayload.results : rankSearchResults(searchQuery, [])),
    [searchPayload.results, searchQuery]
  );

  const topMatch = searchPayload.top_match || rankedMovies[0] || null;
  const relatedMovies = useMemo(
    () => (searchPayload.related_results?.length
      ? searchPayload.related_results.slice(0, 24)
      : rankedMovies.slice(topMatch ? 1 : 0, 25)),
    [rankedMovies, searchPayload.related_results, topMatch]
  );

  const visibleResults = useMemo(
    () => (topMatch ? [topMatch, ...relatedMovies] : relatedMovies),
    [relatedMovies, topMatch]
  );
  const providerMap = useWatchProviderBadges(visibleResults.map((movie) => movie.id));
  const resultCountLabel = `${visibleResults.length} ${visibleResults.length === 1 ? "result" : "results"}`;

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const nextQuery = draftQuery.trim();

    if (!nextQuery) {
      return;
    }

    navigate(`/search?q=${encodeURIComponent(nextQuery)}`);
  };

  const searchStructuredData = useMemo(
    () => [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Search", path: `/search?q=${encodeURIComponent(searchQuery)}` },
      ]),
      visibleResults.length
        ? buildItemListJsonLd(
            visibleResults.slice(0, 12).map((movie) => ({
              name: movie.title,
              path: getMoviePath(movie),
            }))
          )
        : null,
    ].filter(Boolean),
    [searchQuery, visibleResults]
  );

  usePageMetadata({
    title: searchQuery ? `Search Results for "${searchQuery}" | ReelBot` : "Search | ReelBot",
    description: searchQuery
      ? `TMDB-powered movie search results for "${searchQuery}", with ReelBot-ready detail pages and next-watch help.`
      : "TMDB-powered movie search results, with ReelBot-ready detail pages and next-watch help.",
    path: "/search",
    robots: "noindex,follow",
    structuredData: searchStructuredData,
  });

  return (
    <div className="browse-page search-results-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo search-results-hero">
          <div className="browse-copy search-results-hero-copy">
            <div className="browse-kicker">ReelBot Search</div>
            <h1 className="browse-title">Results for “{searchQuery || "your search"}”</h1>
            <p className="browse-subtitle">We surface the clearest match first, then keep the strongest nearby titles within easy reach.</p>
          </div>

          <div className="search-results-toolbar">
            <form onSubmit={handleSearchSubmit} className="search-bar search-results-form">
              <input
                type="text"
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder="Search by title, franchise, actor, or director"
                aria-label="Search movies"
              />
              <button type="submit">Search Again</button>
            </form>
            {!loading && !error ? <div className="results-count results-count--context">{resultCountLabel}</div> : null}
          </div>
        </section>

        {loading && (
          <div className="loading-message">
            <span className="status-glyph" aria-hidden="true"></span>
            <span>Searching movies...</span>
          </div>
        )}
        {error && <p className="error-message">{error}</p>}

        {!loading && !error && (
          <>
            <div className="section-header section-header--stacked-mobile section-header--compact search-results-section-head">
              <div>
                <div className="detail-description-label">Search results</div>
                <h2 className="section-title">{topMatch ? "Top Match" : "Matching Movies"}</h2>
                <p className="section-subtitle">
                  {topMatch
                    ? "This is the clearest match based on title, relevance, and overall quality."
                    : "We could not find a strong match for that search just yet."}
                </p>
              </div>
              <div className="results-count">{resultCountLabel}</div>
            </div>

            {topMatch ? (
              <article className="search-top-match-card">
                <Link to={getMoviePath(topMatch)} className="search-top-match-poster-link" aria-label={`Open ${topMatch.title}`}>
                  {topMatch.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w300${topMatch.poster_path}`}
                      alt={topMatch.title}
                      className="search-top-match-poster"
                    />
                  ) : (
                    <div className="search-top-match-poster search-top-match-poster--placeholder">Poster unavailable</div>
                  )}
                </Link>

                <div className="search-top-match-content">
                  <div className="search-top-match-main">
                    <div className="detail-description-label">Best Match</div>
                    <h3 className="search-top-match-title">
                      <Link to={getMoviePath(topMatch)} className="movie-title-link">
                        {topMatch.title}
                      </Link>
                    </h3>
                    <div className="movie-card-meta">
                      <span className="movie-card-chip">{getReleaseYear(topMatch.release_date)}</span>
                      {topMatch.vote_average ? <span className="movie-card-chip">TMDB {topMatch.vote_average.toFixed(1)}</span> : null}
                      <span className="movie-card-chip movie-card-chip--accent">{topMatch.exact_match ? "Exact Match" : "Best Fit"}</span>
                    </div>
                    <p className="search-top-match-summary">
                      {topMatch.exact_match
                        ? "Exact title match with the clearest overall fit in these results."
                        : "The clearest title match with the strongest overall quality and relevance."}
                    </p>
                    {topMatch.overview ? <p className="search-top-match-overview">{topMatch.overview}</p> : null}
                    <ProviderBadgeRow badges={providerMap[topMatch.id]?.provider_badges} compact />
                  </div>

                  <aside className="search-top-match-aside">
                    <div className="search-top-match-fact-label">Release</div>
                    <p className="detail-secondary-text search-top-match-date">{formatMovieDate(topMatch.release_date)}</p>
                    <div className="search-top-match-actions">
                      <Link to={getMoviePath(topMatch)} className="card-link">
                        View Details
                      </Link>
                      <Link
                        to={getMoviePath(topMatch)}
                        state={{ reelbotAction: "is_this_for_me", fromCard: true }}
                        className="movie-card-ask-reelbot search-top-match-ask"
                      >
                        Ask ReelBot
                        <span className="movie-card-ask-copy">Is this for me?</span>
                      </Link>
                    </div>
                  </aside>
                </div>
              </article>
            ) : null}

            {relatedMovies.length ? (
              <section className="search-related-section">
                <div className="section-header section-header--compact section-header--stacked-mobile">
                  <div>
                    <div className="detail-description-label">Related titles</div>
                    <h3 className="section-title">Other likely matches</h3>
                    <p className="section-subtitle">Nearby title matches and stronger alternates, with weak results pushed down.</p>
                  </div>
                </div>

                <div className="movie-list search-related-grid">
                  {relatedMovies.map((movie) => (
                    <article key={movie.id} className="movie-card search-result-card">
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
                        <ProviderBadgeRow badges={providerMap[movie.id]?.provider_badges} compact />

                        <h3 className="movie-card-title">
                          <Link to={getMoviePath(movie)} className="movie-title-link">
                            {movie.title}
                          </Link>
                        </h3>
                        <p className="movie-card-date">{formatMovieDate(movie.release_date)}</p>
                        {movie.overview ? <p className="movie-card-overview search-result-overview">{movie.overview}</p> : null}

                        <div className="movie-card-actions-row">
                          <Link to={getMoviePath(movie)} className="card-link">
                            View Details
                          </Link>
                          <Link
                            to={getMoviePath(movie)}
                            state={{ reelbotAction: "is_this_for_me", fromCard: true }}
                            className="movie-card-ask-reelbot"
                          >
                            Ask ReelBot
                            <span className="movie-card-ask-copy">Is this for me?</span>
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {!topMatch && !relatedMovies.length ? (
              <div className="empty-state">
                <span className="status-glyph" aria-hidden="true"></span>
                <span>No strong results found. Try a fuller title or browse what&apos;s trending instead.</span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default SearchResults;
