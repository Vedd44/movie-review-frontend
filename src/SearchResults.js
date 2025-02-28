import React, { useState, useEffect } from "react";
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
    setQuery(searchQuery);

    if (!searchQuery) {
      setError("No search query provided.");
      setLoading(false);
      return;
    }

    axios
      .get(`${process.env.REACT_APP_API_URL}/search?query=${searchQuery}`)
      .then((response) => {
        console.log("✅ API Response:", response.data); // Debugging
        if (response.data.results) {
          setMovies(response.data.results);
        } else {
          setMovies([]); // Set an empty array to prevent .map() errors
        }
        setError(null);
      })
      .catch((error) => {
        console.error("❌ Error fetching search results:", error);
        setError("Failed to fetch search results.");
        setMovies([]); // Ensure movies is always an array
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="container">
      <h2>Search Results for: "{query}"</h2>

      {loading && <p className="loading-message">🔄 Loading results...</p>}

      {error && <p className="error-message">{error}</p>}

      <div className="movie-list">
            <a href="/"> HOME </a>
    </div>
        {Array.isArray(movies) && movies.length > 0 ? (
          movies.map((movie) => (
            <div key={movie.id} className="movie-card">
              {movie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                  alt={movie.title}
                  className="movie-poster"
                />
              ) : (
                <div className="no-poster">No Image Available</div>
              )}
              <h3>{movie.title} ({movie.release_date})</h3>
              <button onClick={() => (window.location.href = `/movies/${movie.id}`)}>
                View Details
              </button>
            </div>
          ))
        ) : (
          !loading && <p>No results found.</p>
        )}
      </div>
  );
}

export default SearchResults;
