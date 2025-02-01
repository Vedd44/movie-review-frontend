import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./App.css";

function SearchResults() {
  const [movies, setMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search).get("q");

  useEffect(() => {
    if (query) {
      axios
        .get(`http://localhost:5000/search?query=${query}`)
        .then((response) => {
          setMovies(response.data);
        })
        .catch((error) => {
          console.error("Error fetching search results:", error);
          setError("Failed to fetch search results.");
        });
    }
  }, [query]);

  // ✅ Fetch AI Summary
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
      <button className="back-button" onClick={() => navigate("/")}>⬅ Back</button>
      <h2>Search Results for "{query}"</h2>

      {error && <p className="error-message">{error}</p>}

      <div className="movie-list">
        {movies.map((movie) => (
          <div key={movie.id} className="movie-card">
            <img
              src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
              alt={movie.title}
              className="movie-poster"
            />
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
            {loading ? <p>🔄 Fetching AI summary...</p> : aiSummary && (
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
        </div>
      )}
    </div>
  );
}

export default SearchResults;
