import personDescription from './personDescription';
import ArtworkFallback from "./components/ArtworkFallback";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import NotFound from "./NotFound";
import { buildAbsoluteUrl } from "./siteConfig";
import MovieCardMeta from "./components/MovieCardMeta";
import { API_BASE_URL, formatMovieDate, getMoviePath, getPersonPath } from "./discovery";
import { buildBreadcrumbJsonLd, buildItemListJsonLd, usePageMetadata } from "./seo";
import { useAskReelbotPageContext } from "./context/AskReelbotContext";

// Cast role descriptions can contain job titles. Classify the Actor prefix
// before examining crew jobs so character names never become crew credits.
const getCreditRole = (role) => {
  const credit = String(role || "").trim();
  if (/^Actor(?::|$)/i.test(credit)) return "Actor";
  if (/^Director$/i.test(credit)) return "Director";
  if (/Produc/i.test(credit)) return "Producer";
  if (/Writ|Screenplay|Story/i.test(credit)) return "Writer";
  return null;
};

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
  const [sortDirection, setSortDirection] = useState("popular");
  const [roleFilter, setRoleFilter] = useState("all");
  const [releaseFilter, setReleaseFilter] = useState("all");
  const [includeAppearances, setIncludeAppearances] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setLoading(true);
    setError(null);
    setPerson(null);
    setBioExpanded(false);

    const endpoint = personId
      ? `${API_BASE_URL}/person/${personId}`
      : `${API_BASE_URL}/people/resolve/${encodeURIComponent(personSlug)}`;

    axios
      .get(endpoint, { signal: controller.signal })
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
        if (cancelled || controller.signal.aborted) return;
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
      controller.abort();
    };
  }, [location.pathname, navigate, personId, personSlug]);

  const roleOptions = useMemo(() => {
    const roles = new Set();
    (person?.movie_credits || []).forEach((movie) => {
      (movie.roles || []).forEach((role) => {
        const category = getCreditRole(role);
        if (category) roles.add(category);
      });
    });
    return ["Actor", "Director", "Producer", "Writer"].filter((role) => roles.has(role));
  }, [person?.movie_credits]);

  const sortedCredits = useMemo(() => {
    const now = Date.now();
    const filtered = (person?.movie_credits || []).filter((movie) => {
      const roles = movie.roles || [];
      const appearanceOnly = roles.length && roles.every(role => /^Actor:.*(?:\bSelf\b|\bHimself\b|\bHerself\b|archive footage)/i.test(role));
      if (!includeAppearances && appearanceOnly) return false;
      const roleMatch = roleFilter === "all"
        || roles.some((role) => getCreditRole(role) === roleFilter);
      const time = getCreditTime(movie);
      const releaseMatch = releaseFilter === "all"
        || (releaseFilter === "upcoming" ? time === null || time > now : time !== null && time <= now);
      return roleMatch && releaseMatch;
    });
    return sortCredits(filtered, releaseFilter === "upcoming" ? "oldest" : sortDirection);
  }, [person?.movie_credits, releaseFilter, roleFilter, sortDirection, includeAppearances]);

  useAskReelbotPageContext(useMemo(() => ({
    page: "person",
    personId: person?.id || personId || null,
    personName: person?.name || "",
    visibleMovieIds: sortedCredits.filter(movie => movie.release_date && movie.release_date <= new Date().toISOString().slice(0, 10)).slice(0, 50).map(movie => movie.id),
    person: person ? { id: person.id, name: person.name } : null,
  }), [person, personId, sortedCredits]));

  usePageMetadata({
    title: person?.name ? `${person.name} Movies & Filmography | ReelBot` : "Movie Filmography | ReelBot",
    description: person?.name ? personDescription(person.name) : "Explore movie filmographies, credits, roles, release dates, ratings, and movie details on ReelBot.",
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
            <ArtworkFallback className="person-profile-image person-profile-image--placeholder" />
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
              <label>Release<select aria-label="Filter by release" value={releaseFilter} onChange={event => setReleaseFilter(event.target.value)}>
                <option value="all">All</option><option value="past">Released</option><option value="upcoming">Upcoming</option>
              </select></label>
              {roleOptions.length > 1 ? <label>Role<select aria-label="Filter by role" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}>
                <option value="all">All roles</option>{roleOptions.map(role => <option key={role}>{role}</option>)}
              </select></label> : null}
              <label>Sort<select aria-label="Sort filmography" value={releaseFilter === "upcoming" ? "oldest" : sortDirection} disabled={releaseFilter === "upcoming"} onChange={event => setSortDirection(event.target.value)}>
                <option value="popular">Most rated</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option>
              </select></label>
            </div>
          </div>

          <label className="person-appearances-toggle"><input type="checkbox" checked={includeAppearances} onChange={event => setIncludeAppearances(event.target.checked)} /> Include self appearances and archive footage</label>
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
                      <ArtworkFallback className="person-credit-poster person-credit-poster--placeholder" />
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
