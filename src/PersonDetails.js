import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import { API_BASE_URL, formatMovieDate, getMoviePath, getReleaseYear } from "./discovery";
import { buildBreadcrumbJsonLd, buildItemListJsonLd, usePageMetadata } from "./seo";

const getCreditTime = (movie) => {
  const date = movie?.release_date ? new Date(movie.release_date) : null;
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
};

const sortCredits = (credits = [], sortDirection = "newest") =>
  [...credits].sort((left, right) => {
    const leftTime = getCreditTime(left);
    const rightTime = getCreditTime(right);

    if (leftTime === null && rightTime === null) {
      return (right.popularity || 0) - (left.popularity || 0);
    }

    if (leftTime === null) return 1;
    if (rightTime === null) return -1;

    return sortDirection === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });

function PersonDetails() {
  const { personId } = useParams();
  const [person, setPerson] = useState(null);
  const [sortDirection, setSortDirection] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    axios
      .get(`${API_BASE_URL}/person/${personId}`)
      .then((response) => {
        if (!cancelled) {
          setPerson(response.data);
        }
      })
      .catch((requestError) => {
        console.error("Error fetching person details:", requestError);
        if (!cancelled) {
          setError("Failed to load this filmography.");
          setPerson(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [personId]);

  const sortedCredits = useMemo(
    () => sortCredits(person?.movie_credits || [], sortDirection),
    [person?.movie_credits, sortDirection]
  );

  usePageMetadata({
    title: person?.name ? `${person.name} Filmography | ReelBot` : "Filmography | ReelBot",
    description: person?.name ? `Browse ${person.name}'s movie credits ordered by release date.` : "Browse movie credits ordered by release date.",
    path: `/person/${personId}`,
    image: person?.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : undefined,
    structuredData: [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: person?.name || "Person", path: `/person/${personId}` },
      ]),
      sortedCredits.length
        ? buildItemListJsonLd(
            sortedCredits.slice(0, 20).map((movie) => ({
              name: movie.title,
              path: getMoviePath(movie),
            }))
          )
        : null,
    ].filter(Boolean),
  });

  if (loading) {
    return (
      <div className="loading-message">
        <span className="status-glyph" aria-hidden="true"></span>
        <span>Loading filmography...</span>
      </div>
    );
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  if (!person) {
    return <p className="error-message">No person data available.</p>;
  }

  return (
    <div className="browse-page person-page">
      <div className="container browse-shell person-shell">
        <section className="browse-hero browse-hero--compact person-hero">
          {person.profile_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
              alt={person.name}
              className="person-profile-image"
            />
          ) : (
            <div className="person-profile-image person-profile-image--placeholder">No photo</div>
          )}

          <div className="browse-copy">
            <div className="browse-kicker">{person.known_for_department || "Filmography"}</div>
            <h1 className="browse-title">{person.name}</h1>
            <p className="browse-subtitle browse-subtitle--hero">Movies ordered by release date.</p>
          </div>
        </section>

        <section className="detail-info-card person-filmography-section">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <div className="detail-description-label">Filmography</div>
              <h2 className="section-title">Movie Credits</h2>
              <p className="section-subtitle">Movie roles and credits, with TV excluded for now.</p>
            </div>

            <div className="person-sort-toggle" role="group" aria-label="Sort filmography">
              <button
                type="button"
                className={sortDirection === "newest" ? "active" : ""}
                onClick={() => setSortDirection("newest")}
              >
                Newest first
              </button>
              <button
                type="button"
                className={sortDirection === "oldest" ? "active" : ""}
                onClick={() => setSortDirection("oldest")}
              >
                Oldest first
              </button>
            </div>
          </div>

          {sortedCredits.length ? (
            <div className="person-credit-list">
              {sortedCredits.map((movie) => (
                <article key={movie.id} className="person-credit-card">
                  <a href={getMoviePath(movie)} className="person-credit-poster-link" aria-label={`Open ${movie.title}`}>
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`}
                        alt={movie.title}
                        className="person-credit-poster"
                      />
                    ) : (
                      <div className="person-credit-poster person-credit-poster--placeholder">Poster unavailable</div>
                    )}
                  </a>

                  <div className="person-credit-copy">
                    <div className="movie-card-meta">
                      <span className="movie-card-chip">{getReleaseYear(movie.release_date)}</span>
                      {movie.vote_average ? <span className="movie-card-chip">TMDB {movie.vote_average.toFixed(1)}</span> : null}
                    </div>
                    <h3 className="person-credit-title">
                      <a href={getMoviePath(movie)} className="movie-title-link">
                        {movie.title}
                      </a>
                    </h3>
                    <p className="movie-card-date">{formatMovieDate(movie.release_date)}</p>
                    {movie.roles?.length ? <p className="person-credit-role">{movie.roles.join(" / ")}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="status-glyph" aria-hidden="true"></span>
              <span>No movie credits found yet.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default PersonDetails;
