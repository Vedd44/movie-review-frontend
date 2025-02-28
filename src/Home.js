import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

// ✅ Define API Base URL from .env
const API_BASE_URL = process.env.REACT_APP_API_URL;

console.log("Backend API URL:", API_BASE_URL); // ✅ Debugging Step

function Home() {
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [movieType, setMovieType] = useState("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFullReview, setShowFullReview] = useState({ top: false, bottom: false });

  // ✅ Fetch movies based on type & page
  useEffect(() => {
    setError(null);
    console.log("Fetching movies from:", `${API_BASE_URL}/movies?type=${movieType}&page=${currentPage}`); // ✅ Debugging

    axios
      .get(`${API_BASE_URL}/movies?type=${movieType}&page=${currentPage}`)
      .then((response) => {
        console.log("Fetched movies:", response.data); // ✅ Debugging
        setMovies(response.data.results);
        setTotalPages(response.data.total_pages);
      })
      .catch((error) => {
        console.error(`Error fetching ${movieType} movies:`, error);
        setError(`Failed to fetch ${movieType} movies.`);
      });
  }, [movieType, currentPage]);

  // ✅ Fetch AI summary
  const fetchAiSummary = (movie) => {
    setSelectedMovie(movie);
    setAiSummary(null);
    setError(null);
    setLoading(true);
    setModalOpen(true);

    console.log(`Fetching AI summary for movie ID: ${movie.id}`); // ✅ Debugging

    axios
      .get(`${API_BASE_URL}/movies/${movie.id}/ai-summary`)
      .then((response) => {
        console.log("AI Summary Response:", response.data); // ✅ Debugging
        setAiSummary(response.data);
      })
      .catch((error) => {
        console.error("Error fetching AI summary:", error);
        setError("Failed to fetch AI summary.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="container">
      {/* 🔍 Search Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          window.location.href = `/search?q=${query}`;
        }}
        className="search-bar"
      >
        <input
          type="text"
          placeholder="Search for a movie..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit">🔍 Search</button>
      </form>

      {/* ✅ Movie Type Tabs */}
      <div className="tabs">
        <button className={movieType === "latest" ? "active" : ""} onClick={() => setMovieType("latest")}>
          Latest
        </button>
        <button className={movieType === "popular" ? "active" : ""} onClick={() => setMovieType("popular")}>
          Popular
        </button>
      </div>

      <h2>{movieType === "latest" ? "Latest Movies" : "Popular Movies"}</h2>

      {error && <p className="error-message">{error}</p>}

      <div className="movie-list">
        {movies.map((movie) => {
          const formattedDate = movie.release_date
            ? new Date(movie.release_date).toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : "N/A"; // Default if no release date

          return (
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
              <h3>
                {movie.title} <br />
                <h5>Release Date: {formattedDate}</h5>
              </h3>
              <button onClick={() => fetchAiSummary(movie)}>Get AI Summary</button>
            </div>
          );
        })}
      </div>

      {/* ✅ Pagination */}
      <div className="pagination">
        <button disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => prev - 1)}>
          ⬅ Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((prev) => prev + 1)}>
          Next ➡
        </button>
      </div>

      {/* ✅ AI Summary Modal */}
      {modalOpen && selectedMovie && (
        <div className="modal">
          <div className="modal-content">
            <button className="close-button" onClick={() => setModalOpen(false)}>✖</button>
            <h2>AI Summary for {selectedMovie.title}</h2>

            {loading ? (
              <p className="loading-message">🔄 Fetching AI summary...</p>
            ) : aiSummary ? (
              <>
                <p><strong>🎬 Directed by:</strong> {aiSummary.director}</p>
                <p><strong>📌 Genre:</strong> {aiSummary.genre}</p>
                <p><strong>🎭 Mood Tags:</strong> {aiSummary.mood_tags.join(", ")}</p>

                <h3>🤖 ReelBot's Thoughts:</h3>
                <p>{aiSummary.summary}</p>

                {aiSummary.recommendations && (
                  <div>
                    <h3>🎞️ Recommended if you liked:</h3>
                    <div className="recommended-movies">
                      {aiSummary.recommendations.split(", ").map((movie, index) => (
                        <a key={index} href={`/search?q=${movie}`} className="movie-recommendation">
                          <div className="movie-thumbnail">{movie}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="error-message">No summary available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
