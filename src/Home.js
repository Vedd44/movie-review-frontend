import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function Home() {
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // ✅ Fetch latest movies
  useEffect(() => {
    axios
      .get("http://localhost:5000/movies/latest")
      .then((response) => {
        setMovies(response.data);
      })
      .catch((error) => {
        console.error("Error fetching movies:", error);
        setError("Failed to fetch latest movies.");
      });
  }, []);

  // ✅ Fetch AI summary
  const fetchAiSummary = (movie) => {
    setSelectedMovie(movie);
    setAiSummary(null);
    setError(null);
    setLoading(true);
    setModalOpen(true);

    axios
      .get(`http://localhost:5000/movies/${movie.id}/ai-summary`)
      .then((response) => {
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
      <form onSubmit={(e) => { e.preventDefault(); window.location.href = `/search?q=${query}`; }} className="search-bar">
        <input
          type="text"
          placeholder="Search for a movie..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit">🔍 Search</button>
      </form>

      <h2>Latest Movies</h2>

      {error && <p className="error-message">{error}</p>}

      <div className="movie-list">
        {movies.map((movie) => (
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
            <button onClick={() => fetchAiSummary(movie)}>Get AI Summary</button>
          </div>
        ))}
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
              <div>
                <p><strong>Summary:</strong></p>
                <p>{aiSummary.summary}</p>

                <p><strong>Top Review:</strong></p>
                <p>{aiSummary.top_review}</p>

                <p><strong>Bottom Review:</strong></p>
                <p>{aiSummary.bottom_review}</p>

                {/* ✅ Display Recommendations as Bulleted List with Links */}
                {aiSummary.recommendations && (
                  <div>
                    <p><strong>Recommended if you liked:</strong></p>
                    <ul>
                      {aiSummary.recommendations.split(", ").map((movie, index) => (
                        <li key={index}>
                          <a href={`/search?q=${movie}`} className="movie-link">{movie}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
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
