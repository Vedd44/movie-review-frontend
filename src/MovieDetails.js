import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";

function MovieDetails() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullReview, setShowFullReview] = useState({ top: false, bottom: false });

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        setLoading(true);
        const movieResponse = await axios.get(`${process.env.REACT_APP_API_URL}/movies/${id}`);
        setMovie(movieResponse.data);

        const aiResponse = await axios.get(`${process.env.REACT_APP_API_URL}/movies/${id}/ai-summary`);
        setAiSummary(aiResponse.data);

        setError(null);
      } catch (err) {
        console.error("Error fetching movie details:", err);
        setError("Failed to load movie details.");
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [id]);

  if (loading) return <p className="loading-message">🔄 Loading movie details...</p>;
  if (error) return <p className="error-message">{error}</p>;
  if (!movie || !aiSummary) return <p className="error-message">No data available.</p>;
 
  return (
    <div className="movie-details-container">
      <div class="home_btn">
    	<a href="/"> HOME </a>
	  </div>
      <h1>{movie.title} ({movie.release_date})</h1>

      <div className="movie-info">
        <img 
          src={movie.poster_path ? `https://image.tmdb.org/t/p/w300${movie.poster_path}` : "/placeholder.jpg"} 
          alt={movie.title} 
          className="movie-poster-large"
        />

        <div className="movie-text">
          <p><strong>🎬 Directed by:</strong> {aiSummary.director}</p>
          <p><strong>📌 Genre:</strong> {aiSummary.genre}</p>
          <p><strong>🎭 Mood Tags:</strong> {aiSummary.mood_tags.join(", ")}</p>

          <h3>🤖 ReelBot's Thoughts:</h3>
          <p>{aiSummary.summary}</p>
        </div>
      </div>

      {/* ✅ Top Review */}
      <div className="review-section">
        <h3>👍 Top Review by {aiSummary.top_review_author}:</h3>
        <p>{aiSummary.top_review.length > 200 && !showFullReview.top 
            ? aiSummary.top_review.slice(0, 200) + "..." 
            : aiSummary.top_review}
        </p>
        {aiSummary.top_review.length > 200 && (
          <button onClick={() => setShowFullReview({ ...showFullReview, top: !showFullReview.top })}>
            {showFullReview.top ? "See Less" : "See More"}
          </button>
        )}
        <p><a href={aiSummary.top_review_url} target="_blank" rel="noopener noreferrer">Read full review</a></p>
      </div>

      {/* ✅ Bottom Review */}
      <div className="review-section">
        <h3>👎 Bottom Review by {aiSummary.bottom_review_author}:</h3>
        <p>{aiSummary.bottom_review.length > 200 && !showFullReview.bottom 
            ? aiSummary.bottom_review.slice(0, 200) + "..." 
            : aiSummary.bottom_review}
        </p>
        {aiSummary.bottom_review.length > 200 && (
          <button onClick={() => setShowFullReview({ ...showFullReview, bottom: !showFullReview.bottom })}>
            {showFullReview.bottom ? "See Less" : "See More"}
          </button>
        )}
        <p><a href={aiSummary.bottom_review_url} target="_blank" rel="noopener noreferrer">Read full review</a></p>
      </div>

      {/* ✅ Recommended Movies */}
      {aiSummary.recommendations && (
        <div className="recommended-movies-section">
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
    </div>
  );
}

export default MovieDetails;
