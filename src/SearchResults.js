import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "./App.css";

function SearchResults() {
  const [movies, setMovies] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get("q");
    setQuery(searchQuery || "");

    if (!searchQuery) {
      setError("No search query provided.");
      setLoading(false);
      return;
    }

    axios
      .get(`${process.env.REACT_APP_API_URL}/search?query=${encodeURIComponent(searchQuery)}`)
      .then((response) => {
        setMovies(response.data.results || []);
        setError(null);
      })
      .catch((requestError) => {
        console.error("❌ Error fetching search results:", requestError);
        setError("Failed to fetch search results.");
        setMovies([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="browse-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact">
          <div className="browse-copy">
            <div className="browse-kicker">ReelBot Search</div>
            <h1 className="browse-title">Results for “{query || "your search"}”</h1>
            <p className="browse-subtitle">
              TMDB-powered results up front. Open any movie when you want ReelBot to step in.
            </p>
          </div>
        </section>

        {loading && (
          <div className="loading-message">
            <span className="status-glyph" aria-hidden="true"></span>
            <span>Loading results...</span>
          </div>
        )}
        {error && <p className="error-message">{error}</p>}

        {!loading && !error && (
          <>
            <div className="section-header">
              <div>
                <h2 className="section-title">Matching Movies</h2>
                <p className="section-subtitle">TMDB search results, ready for deeper ReelBot exploration.</p>
              </div>
              <div className="results-count">{movies.length} matches</div>
            </div>

            <div className="movie-list">
              {Array.isArray(movies) && movies.length > 0 ? (
                movies.map((movie) => {
                  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : "TBA";
                  const formattedDate = movie.release_date
                    ? new Date(movie.release_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Release date unavailable";

                  return (
                    <article key={movie.id} className="movie-card">
                      <Link to={`/movies/${movie.id}`} className="movie-poster-link" aria-label={`Open ${movie.title}`}>
                        {movie.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                            alt={movie.title}
                            className="movie-poster"
                          />
                        ) : (
                          <div className="no-poster">No Image Available</div>
                        )}
                      </Link>

                      <div className="movie-card-content">
                        <div className="movie-card-meta">
                          <span className="movie-card-chip">{releaseYear}</span>
                          {movie.vote_average ? (
                            <span className="movie-card-chip">TMDB {movie.vote_average.toFixed(1)}</span>
                          ) : null}
                        </div>

                        <h3 className="movie-card-title">
                          <Link to={`/movies/${movie.id}`} className="movie-title-link">
                            {movie.title}
                          </Link>
                        </h3>
                        <p className="movie-card-date">{formattedDate}</p>

                        <Link to={`/movies/${movie.id}`} className="card-link">
                          View Details
                        </Link>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="empty-state">
                  <span className="status-glyph" aria-hidden="true"></span>
                  <span>No results found.</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SearchResults;
