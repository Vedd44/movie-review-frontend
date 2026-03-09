import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import "./App.css";

const API_BASE_URL = process.env.REACT_APP_API_URL;
const VALID_VIEWS = new Set(["latest", "popular", "upcoming"]);

const MOOD_FILTERS = [
  {
    id: "all",
    label: "All",
    hint: "No mood filter",
    predicate: () => true,
  },
  {
    id: "easy_watch",
    label: "Easy Watch",
    hint: "Lighter, low-friction picks",
    predicate: (movie) => [35, 10751, 16, 10749, 12].some((genreId) => movie.genre_ids?.includes(genreId)),
  },
  {
    id: "mind_bending",
    label: "Mind-Bending",
    hint: "Ideas, twists, and weird energy",
    predicate: (movie) => [878, 9648, 53].some((genreId) => movie.genre_ids?.includes(genreId)),
  },
  {
    id: "dark",
    label: "Dark",
    hint: "Tense, eerie, or gritty",
    predicate: (movie) => [27, 53, 80].some((genreId) => movie.genre_ids?.includes(genreId)),
  },
  {
    id: "funny",
    label: "Funny",
    hint: "Comedy-forward watches",
    predicate: (movie) => movie.genre_ids?.includes(35),
  },
  {
    id: "feel_something",
    label: "Feel Something",
    hint: "More emotional or reflective",
    predicate: (movie) => [18, 10749, 10402, 16].some((genreId) => movie.genre_ids?.includes(genreId)),
  },
];

const REELBOT_CAPABILITIES = [
  {
    title: "Quick Take",
    description: "Get the tone, viewer fit, and a spoiler-light read in seconds.",
  },
  {
    title: "Why Watch It",
    description: "Get a practical case for whether the runtime is worth it.",
  },
  {
    title: "Spoiler Synopsis",
    description: "Read the full story if you want the insight without the watch.",
  },
  {
    title: "Similar Picks",
    description: "Use ReelBot to find stronger next-watch matches with reasoning.",
  },
];

function Home() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get("view");
  const normalizedInitialView = VALID_VIEWS.has(initialView) ? initialView : "latest";

  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movieType, setMovieType] = useState(normalizedInitialView);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedMood, setSelectedMood] = useState("all");
  const [showCapabilities, setShowCapabilities] = useState(false);

  useEffect(() => {
    const view = searchParams.get("view");
    const normalizedView = VALID_VIEWS.has(view) ? view : "latest";
    setMovieType(normalizedView);
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    axios
      .get(`${API_BASE_URL}/movies?type=${movieType}&page=${currentPage}`)
      .then((response) => {
        const sortedMovies = response.data.results.sort(
          (a, b) => new Date(b.release_date) - new Date(a.release_date)
        );

        setMovies(sortedMovies);
        setTotalPages(response.data.total_pages);
      })
      .catch((requestError) => {
        console.error(`Error fetching ${movieType} movies:`, requestError);
        setError(`Failed to fetch ${movieType} movies.`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [movieType, currentPage]);

  useEffect(() => {
    if (!showCapabilities) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowCapabilities(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showCapabilities]);

  const handleViewChange = (view) => {
    setCurrentPage(1);
    setSearchParams({ view });
  };

  const selectedMoodConfig = useMemo(
    () => MOOD_FILTERS.find((filter) => filter.id === selectedMood) || MOOD_FILTERS[0],
    [selectedMood]
  );

  const filteredMovies = useMemo(
    () => movies.filter((movie) => selectedMoodConfig.predicate(movie)),
    [movies, selectedMoodConfig]
  );

  const heading =
    movieType === "latest"
      ? "Latest Movies"
      : movieType === "popular"
        ? "Popular Movies"
        : "Coming Soon";

  const sectionSubtitle =
    selectedMood === "all"
      ? "Fresh picks for right now. Open any movie for the TMDB basics first, then ask ReelBot for more."
      : `Filtered to match a ${selectedMoodConfig.label.toLowerCase()} mood.`;

  return (
    <div className="browse-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact">
          <div className="browse-copy">
            <h1 className="browse-title browse-title--brand">ReelBot</h1>
            <div className="browse-powered">Powered by TMDB & OpenAI</div>
            <p className="browse-subtitle browse-subtitle--hero">
              Find something worth watching faster. Open any movie for the basics, then ask ReelBot when you want the extra layer.
            </p>

            <div className="browse-hero-actions">
              <button type="button" className="reelbot-inline-button" onClick={() => setShowCapabilities(true)}>
                What ReelBot can do
              </button>
              <span className="browse-hero-note">Quick takes, spoiler synopses, and smarter next-watch picks.</span>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!query.trim()) {
                return;
              }
              navigate(`/search?q=${encodeURIComponent(query.trim())}`);
            }}
            className="search-bar search-bar--hero"
          >
            <input
              type="text"
              placeholder="Search for a movie..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit">Search</button>
          </form>
        </section>

        <div className="tabs browse-tabs">
          <button className={movieType === "latest" ? "active" : ""} onClick={() => handleViewChange("latest")}>
            Latest
          </button>
          <button className={movieType === "popular" ? "active" : ""} onClick={() => handleViewChange("popular")}>
            Popular
          </button>
          <button className={movieType === "upcoming" ? "active" : ""} onClick={() => handleViewChange("upcoming")}>
            Coming Soon
          </button>
        </div>

        <section className="mood-rail">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <h2 className="section-title">Pick a mood</h2>
              <p className="section-subtitle">Quick mood filters for the movies on this page.</p>
            </div>
            <div className="results-count">{selectedMoodConfig.label}</div>
          </div>

          <div className="mood-chip-row" role="group" aria-label="Filter movies by mood">
            {MOOD_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`mood-rail-chip${selectedMood === filter.id ? " is-active" : ""}`}
                onClick={() => setSelectedMood(filter.id)}
                title={filter.hint}
                aria-pressed={selectedMood === filter.id}
              >
                <span className="mood-rail-chip-label">{filter.label}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="section-header">
          <div>
            <h2 className="section-title">{heading}</h2>
            <p className="section-subtitle">{sectionSubtitle}</p>
          </div>
          <div className="results-count">{filteredMovies.length} titles</div>
        </div>

        {loading && (
          <div className="loading-message">
            <span className="status-glyph" aria-hidden="true"></span>
            <span>Loading movies...</span>
          </div>
        )}
        {error && <p className="error-message">{error}</p>}

        {!loading && !error && (
          <div className="movie-list">
            {filteredMovies.length > 0 ? (
              filteredMovies.map((movie) => {
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
                <span>Nothing on this page matches that mood yet. Try another mood or change the movie list.</span>
              </div>
            )}
          </div>
        )}

        <div className="pagination browse-pagination">
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
      </div>

      {showCapabilities ? (
        <div className="reelbot-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reelbot-modal-title">
          <div className="reelbot-modal">
            <button
              type="button"
              className="reelbot-modal-close"
              onClick={() => setShowCapabilities(false)}
              aria-label="Close ReelBot capabilities"
            >
              ×
            </button>

            <div className="reelbot-modal-kicker">On-demand only</div>
            <h2 id="reelbot-modal-title" className="reelbot-modal-title">
              What ReelBot can do
            </h2>
            <p className="reelbot-modal-copy">
              Open any movie to unlock the AI layer when you want it. ReelBot stays out of the way until you ask.
            </p>

            <div className="reelbot-modal-grid">
              {REELBOT_CAPABILITIES.map((capability) => (
                <div key={capability.title} className="reelbot-modal-card">
                  <div className="reelbot-modal-card-title">{capability.title}</div>
                  <p className="reelbot-modal-card-copy">{capability.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Home;
