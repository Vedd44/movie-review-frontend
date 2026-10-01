import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import NotFound from "./NotFound";
import { buildAbsoluteUrl } from "./siteConfig";
import MovieCardMeta from "./components/MovieCardMeta";
import { API_BASE_URL, formatMovieDate, getMoviePath, getPersonPath, } from "./discovery";
import { buildBreadcrumbJsonLd, buildItemListJsonLd, usePageMetadata } from "./seo";
import { useAskReelbotPageContext } from "./context/AskReelbotContext";

const getCreditTime = (movie) => {
  const date = movie?.release_date ? new Date(movie.release_date) : null;
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
};

const sortCredits = (credits = [], sortDirection = "newest") =>
  [...credits].sort((left, right) => {
    const leftTime = getCreditTime(left);
    const rightTime = getCreditTime(right);

    if (sortDirection === "popular") return (right.vote_count || 0) - (left.vote_count || 0);

    if (leftTime === null && rightTime === null) {
      return (right.popularity || 0) - (left.popularity || 0);
    }

    if (leftTime === null) return 1;
    if (rightTime === null) return -1;

    return sortDirection === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });

function PersonDetails() {
  const { personId, personSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [person, setPerson] = useState(null);
  const [sortDirection, setSortDirection] = useState("newest");
  const [roleFilter, setRoleFilter] = useState("all");
  const [releaseFilter, setReleaseFilter] = useState("all");
  const [bioExpanded, setBioExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setPerson(null);
    setBioExpanded(false);

    const endpoint = personId
      ? `${API_BASE_URL}/person/${personId}`
      : `${API_BASE_URL}/people/resolve/${encodeURIComponent(personSlug)}`;

    axios
      .get(endpoint)
      .then((response) => {
        if (!cancelled) {
          setPerson(response.data);
          const canonicalPath = getPersonPath(response.data);
          if (location.pathname !== canonicalPath) {
            navigate(canonicalPath, { replace: true });
          }
        }
      })
      .catch((requestError) => {
        console.error("Error fetching person details:", requestError);
        if (!cancelled) {
          setError(requestError.response?.status === 404 ? "not-found" : "This filmography is temporarily unavailable.");
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
  }, [location.pathname, navigate, personId, personSlug]);

  const roleOptions = useMemo(() => {
    const roles = new Set();
    (person?.movie_credits || []).forEach((movie) => {
      (movie.roles || []).forEach((role) => {
        const normalized = String(role || "");
        if (/^Actor(?::|$)/i.test(normalized)) roles.add("Actor");
        else if (/Director/i.test(normalized)) roles.add("Director");
        else if (/Produc/i.test(normalized)) roles.add("Producer");
        else if (/Writ|Screenplay|Story/i.test(normalized)) roles.add("Writer");
      });
    });
    return ["Actor", "Director", "Producer", "Writer"].filter((role) => roles.has(role));
  }, [person?.movie_credits]);

  const sortedCredits = useMemo(() => {
    const now = Date.now();
    const filtered = (person?.movie_credits || []).filter((movie) => {
      const roles = movie.roles || [];
      const roleMatch = roleFilter === "all"
        || roles.some((role) => roleFilter === "Actor" ? /^Actor(?::|$)/i.test(role) : roleFilter === "Writer" ? /Writ|Screenplay|Story/i.test(role) : new RegExp(roleFilter, "i").test(role));
      const time = getCreditTime(movie);
      const releaseMatch = releaseFilter === "all"
        || (releaseFilter === "upcoming" ? time === null || time > now : time !== null && time <= now);
      return roleMatch && releaseMatch;
    });
    return sortCredits(filtered, releaseFilter === "upcoming" ? "oldest" : sortDirection);
  }, [person?.movie_credits, releaseFilter, roleFilter, sortDirection]);

  useAskReelbotPageContext(useMemo(() => ({
    page: "person",
    personId: person?.id || personId || null,
    personName: person?.name || "",
    person: person ? { id: person.id, name: person.name } : null,
  }), [person, personId]));

  usePageMetadata({
    title: person?.name ? `${person.name} Movies & Filmography | ReelBot` : "Movie Filmography | ReelBot",
    description: person?.name ? `Explore ${person.name}'s movie filmography on ReelBot, including film credits, roles, release dates, ratings, and movie details.` : "Explore movie filmographies, credits, roles, release dates, ratings, and movie details on ReelBot.",
    path: person ? getPersonPath(person) : location.pathname,
    enabled: !loading,
    robots: error ? "noindex,follow" : "index,follow",
    type: "profile",
    image: person?.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : undefined,
    structuredData: [
      person ? { "@context": "https://schema.org", "@type": "Person", name: person.name, url: buildAbsoluteUrl(getPersonPath(person)), description: person.biography || undefined, image: person.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : undefined, jobTitle: person.known_for_department || undefined } : null,
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: person?.name || "Person", path: person ? getPersonPath(person) : "/people" },
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
      <div className="loading-message" role="status">
        <span className="status-glyph" aria-hidden="true"></span>
        <span>Loading filmography...</span>
      </div>
    );
  }

  if (error === "not-found") return <NotFound title="Person not found" />;
  if (error) return <section className="container page-unavailable"><h1>Unable to load this filmography</h1><p role="alert">{error}</p><button className="reelbot-inline-button" onClick={() => window.location.reload()}>Try again</button></section>;

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
              width="185"
              height="278"
            />
          ) : (
            <div className="person-profile-image person-profile-image--placeholder">No photo</div>
          )}

          <div className="browse-copy">
            <h1 className="browse-title">{person.name}</h1>
            <p className="person-summary">{[person.known_for_department, `${person.movie_credits?.length || 0} movie credits`].filter(Boolean).join(" · ")}</p>
          </div>
        </section>

        {person.biography ? <div className="person-biography">
          <p id="person-biography" className={bioExpanded ? "" : "is-collapsed"}>{person.biography}</p>
          {person.biography.length > 240 ? <button className="detail-text-action" aria-expanded={bioExpanded} aria-controls="person-biography" onClick={() => setBioExpanded((value) => !value)}>{bioExpanded ? "Show less" : "Read biography"}</button> : null}
        </div> : null}
        <section className="detail-info-card person-filmography-section">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>

              <h2 className="section-title">Filmography</h2>
              <p className="section-subtitle" aria-live="polite">{sortedCredits.length} {sortedCredits.length === 1 ? "movie" : "movies"}</p>
            </div>

            <div className="person-credit-controls">
              <div className="person-filter-group" role="group" aria-label="Filter by release">
                {["all", "upcoming", "past"].map((filter) => (
                  <button key={filter} type="button" aria-pressed={releaseFilter === filter} className={releaseFilter === filter ? "active" : ""} onClick={() => setReleaseFilter(filter)}>
                    {filter === "all" ? "All" : filter === "upcoming" ? "Upcoming" : "Released"}
                  </button>
                ))}
              </div>
              {roleOptions.length > 1 ? (
                <div className="person-filter-group" role="group" aria-label="Filter by role">
                  <button type="button" aria-pressed={roleFilter === "all"} className={roleFilter === "all" ? "active" : ""} onClick={() => setRoleFilter("all")}>All roles</button>
                  {roleOptions.map((role) => <button key={role} type="button" aria-pressed={roleFilter === role} className={roleFilter === role ? "active" : ""} onClick={() => setRoleFilter(role)}>{role}</button>)}
                </div>
              ) : null}
              <div className="person-sort-toggle" role="group" aria-label="Sort filmography">
                <button type="button" disabled={releaseFilter === "upcoming"} aria-pressed={releaseFilter !== "upcoming" && sortDirection === "popular"} className={releaseFilter !== "upcoming" && sortDirection === "popular" ? "active" : ""} onClick={() => setSortDirection("popular")}>Most rated</button>
                <button type="button" disabled={releaseFilter === "upcoming"} aria-pressed={releaseFilter === "upcoming" ? false : sortDirection === "newest"} className={releaseFilter !== "upcoming" && sortDirection === "newest" ? "active" : ""} onClick={() => setSortDirection("newest")}>Newest</button>
                <button type="button" aria-pressed={releaseFilter === "upcoming" || sortDirection === "oldest"} className={releaseFilter === "upcoming" || sortDirection === "oldest" ? "active" : ""} onClick={() => setSortDirection("oldest")}>Oldest</button>
              </div>
            </div>
          </div>

          {sortedCredits.length ? (
            <div className="person-credit-grid">
              {sortedCredits.map((movie) => (
                <article key={movie.id} className="person-credit-card">
                  <Link to={getMoviePath(movie)} className="person-credit-poster-link" aria-label={`Open ${movie.title}`}>
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`}
                        alt={movie.title}
                        className="person-credit-poster"
                        loading="lazy"
                        decoding="async"
                        width="185"
                        height="278"
                      />
                    ) : (
                      <div className="person-credit-poster person-credit-poster--placeholder">Poster unavailable</div>
                    )}
                  </Link>

                  <div className="person-credit-copy">
                    <MovieCardMeta movie={movie} />
                    <h3 className="person-credit-title">
                      <Link to={getMoviePath(movie)} className="movie-title-link">
                        {movie.title}
                      </Link>
                    </h3>
                    {movie.release_date > new Date().toISOString().slice(0, 10) ? <p className="movie-card-date">{formatMovieDate(movie.release_date)}</p> : null}
                    {movie.roles?.length ? <p className="person-credit-role">{movie.roles.join(" / ")}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="status-glyph" aria-hidden="true"></span>
              <span>No movies match these filters.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default PersonDetails;
