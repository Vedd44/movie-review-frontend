import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import TasteActionBar from "./components/TasteActionBar";
import WatchAvailability from "./components/WatchAvailability";
import TrailerModal from "./components/TrailerModal";
import useTasteProfile from "./hooks/useTasteProfile";
import { API_BASE_URL, getMoviePath, getPersonPath } from "./discovery";
import { buildReelbotTake } from "./detailDecision";
import { buildBreadcrumbJsonLd, usePageMetadata } from "./seo";
import { buildAbsoluteUrl } from "./siteConfig";
import { tasteProfileService } from "./services/tasteProfileService";
import { openAskReelbot, useAskReelbotPageContext } from "./context/AskReelbotContext";
import { trackProductEvent } from "./analytics";

const DETAIL_ANCHOR_OFFSET = 110;
const TITLE_TOKEN_STOPWORDS = new Set(["about", "after", "before", "black", "dark", "first", "house", "movie", "night", "return", "story", "world"]);

const getDistinctiveTitleTokens = (title = "") => String(title || "")
  .toLowerCase()
  .match(/[a-z0-9]+/g)?.filter((token) => token.length >= 5 && !TITLE_TOKEN_STOPWORDS.has(token)) || [];

export const selectDiverseSimilarMovies = (movies = [], limit = 3) => {
  const candidates = Array.isArray(movies) ? movies : [];
  const frequencies = new Map();
  candidates.forEach((movie) => {
    new Set(getDistinctiveTitleTokens(movie?.title)).forEach((token) => frequencies.set(token, (frequencies.get(token) || 0) + 1));
  });

  const usedSeriesTokens = new Set();
  const selected = [];
  candidates.forEach((movie) => {
    if (selected.length >= limit) return;
    const seriesTokens = getDistinctiveTitleTokens(movie?.title).filter((token) => (frequencies.get(token) || 0) > 1);
    if (seriesTokens.some((token) => usedSeriesTokens.has(token))) return;
    seriesTokens.forEach((token) => usedSeriesTokens.add(token));
    selected.push(movie);
  });
  return selected;
};

export const getTimeCommitment = (runtime) => {
  const minutes = Number(runtime || 0);
  if (!minutes) return "TBA";
  if (minutes < 90) return "Short and easy to fit in.";
  if (minutes <= 105) return "Comfortably under two hours.";
  if (minutes <= 120) return "Right around two hours.";
  if (minutes <= 140) return "A longer watch — plan on a little over two hours.";
  if (minutes <= 165) return "A substantial time commitment.";
  return "An epic-length watch.";
};

const formatReleaseDate = (value) => {
  if (!value) return "TBA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBA";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  if (!amount) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: amount >= 100000000 ? "compact" : "standard",
    maximumFractionDigits: amount >= 100000000 ? 1 : 0,
  }).format(amount);
};

const isUpcomingMovie = (movie) => {
  const releaseDate = movie?.release_date ? new Date(movie.release_date) : null;
  return Boolean((movie?.status && movie.status !== "Released") || (releaseDate && !Number.isNaN(releaseDate.getTime()) && releaseDate > new Date()));
};

const formatReviewMeta = (review, source = "TMDB user reviews") => {
  if (!review) return source;
  return [review.author || source, typeof review.rating === "number" ? `${review.rating}/10` : null].filter(Boolean).join(" • ");
};

function PersonCard({ person, role, featured = false }) {
  if (!person?.name) return null;
  const content = (
    <>
      {person.profile_path ? (
        <img src={`https://image.tmdb.org/t/p/w185${person.profile_path}`} alt={person.name} className="detail-person-image" loading="lazy" decoding="async" />
      ) : (
        <div className="detail-person-image detail-person-image--placeholder" aria-hidden="true">{person.name.charAt(0)}</div>
      )}
      <span className="detail-person-copy">
        <strong>{person.name}</strong>
        {role ? <span>{role}</span> : null}
      </span>
    </>
  );

  if (!person.id) return <div className={`detail-person-card${featured ? " detail-person-card--featured" : ""}`}>{content}</div>;
  return <Link to={getPersonPath(person)} className={`detail-person-card${featured ? " detail-person-card--featured" : ""}`}>{content}</Link>;
}

function CastAndDetails({ movie }) {
  const facts = [
    movie.runtime ? { label: "Runtime", value: `${movie.runtime} min` } : null,
    movie.release_date ? { label: "Release", value: formatReleaseDate(movie.release_date) } : null,
    movie.certification ? { label: "Rated", value: movie.certification } : null,
    formatCurrency(movie.revenue || movie.box_office) ? { label: "Box office", value: formatCurrency(movie.revenue || movie.box_office) } : null,
  ].filter(Boolean);

  return (
    <section id="cast-and-details" className="detail-info-card detail-cast-details detail-anchor-target">
      <div className="detail-section-head"><h2 className="detail-section-title">Cast &amp; Details</h2></div>
      {movie.director_credit ? (
        <div className="detail-director-block">
          <div className="detail-description-label">Director</div>
          <PersonCard person={movie.director_credit} role="Director" featured />
        </div>
      ) : null}
      <div className="detail-cast-block">
        <div className="detail-description-label">Principal cast</div>
        <div className="detail-people-grid">
          {(movie.top_cast_credits || []).slice(0, 5).map((person) => (
            <PersonCard key={person.id || person.name} person={person} role={person.character || "Cast"} />
          ))}
        </div>
      </div>
      {facts.length ? (
        <dl className="detail-facts-list">
          {facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
        </dl>
      ) : null}
    </section>
  );
}

function MovieDetails() {
  const { legacyMovieId, movieSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const { profile, actions: tasteActions, getRecommendationContextForMovie } = useTasteProfile();

  useEffect(() => {
    let cancelled = false;
    const numericRouteId = legacyMovieId || (/^\d+$/.test(movieSlug || "") ? movieSlug : "");
    const endpoint = numericRouteId
      ? `${API_BASE_URL}/movies/${numericRouteId}`
      : `${API_BASE_URL}/movies/resolve/${encodeURIComponent(movieSlug || "")}`;

    setLoading(true);
    setError(null);
    axios.get(endpoint)
      .then((response) => {
        if (cancelled) return;
        setMovie(response.data);
        const canonicalPath = getMoviePath(response.data);
        if (location.pathname !== canonicalPath) {
          navigate(canonicalPath, { replace: true, state: location.state });
        }
      })
      .catch((requestError) => {
        console.error("Error fetching movie details:", requestError);
        if (!cancelled) setError("Failed to load movie details.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [legacyMovieId, location.pathname, location.state, movieSlug, navigate]);

  useEffect(() => {
    if (!movie?.id) return;
    void tasteActions.addRecentMovie(movie).catch(() => {});
    void tasteActions.recordDetailView(movie, { source: location.state?.source || "detail_page" }).catch(() => {});
    trackProductEvent("movie_detail_opened", { movie_id: Number(movie.id) });
  }, [location.state?.source, movie, tasteActions]);

  const previewMode = useMemo(() => isUpcomingMovie(movie), [movie]);
  const recommendationContext = useMemo(
    () => getRecommendationContextForMovie(movie?.id),
    [getRecommendationContextForMovie, movie?.id]
  );
  const reelbotTake = useMemo(() => buildReelbotTake({ movie, recommendationContext }), [movie, recommendationContext]);
  const homePickSession = tasteProfileService.loadHomePickSession();
  const sessionMovieIds = useMemo(() => new Set([
    homePickSession?.currentPick?.primary?.id,
    ...((homePickSession?.currentPick?.alternates || []).map((item) => item?.id)),
  ].filter(Boolean)), [homePickSession]);
  const canTryAnother = reelbotTake.hasReliableProvenance && sessionMovieIds.has(movie?.id);
  const displayedSimilarMovies = useMemo(
    () => selectDiverseSimilarMovies((movie?.similar || []).filter((item) => !(profile.skipped || []).some((hidden) => hidden.id === item.id)), 3),
    [movie, profile.skipped]
  );
  const movieDescription = movie?.description || "No description available.";
  const metaItems = [
    movie?.runtime ? `${movie.runtime} min` : null,
    movie?.release_year || null,
    movie?.certification || null,
    movie?.genre_names?.length ? movie.genre_names.join(" • ") : null,
    !previewMode && movie?.rating ? `TMDB ${movie.rating.toFixed(1)}` : null,
  ].filter(Boolean);

  const askPageContext = useMemo(() => ({
    page: "movie_detail",
    movieId: movie?.id || null,
    movieTitle: movie?.title || "",
    movie: movie ? {
      id: movie.id,
      title: movie.title,
      originalTitle: movie.original_title || movie.title,
      year: movie.release_year || null,
      genres: movie.genre_names || [],
      certification: movie.certification || "",
      runtime: movie.runtime || null,
      overview: movie.description || "",
      tagline: movie.tagline || "",
      director: movie.director || "",
      topCast: movie.top_cast || [],
      keywords: movie.keyword_names || [],
      voteAverage: movie.rating || null,
      voteCount: movie.vote_count || 0,
      popularity: movie.popularity || null,
      productionCountries: movie.production_countries || [],
      language: movie.original_language || "",
      watchProviders: movie.watch_providers || null,
      releaseStatus: movie.status || "",
      theaterStatus: movie.availability_status || null,
      knownAudienceSignals: movie.audience_signals || null,
      knownContentSignals: movie.content_signals || null,
    } : null,
  }), [movie]);
  useAskReelbotPageContext(askPageContext);

  const detailStructuredData = useMemo(() => {
    if (!movie) return [buildBreadcrumbJsonLd([{ name: "Home", path: "/" }])];
    const moviePath = getMoviePath(movie);
    return [
      buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Browse", path: "/browse" }, { name: movie.title, path: moviePath }]),
      {
        "@context": "https://schema.org",
        "@type": "Movie",
        name: movie.title,
        description: movieDescription,
        url: buildAbsoluteUrl(moviePath),
        image: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
        datePublished: movie.release_date || undefined,
        genre: movie.genre_names || undefined,
        director: movie.director ? { "@type": "Person", name: movie.director } : undefined,
        actor: (movie.top_cast || []).slice(0, 5).map((name) => ({ "@type": "Person", name })),
      },
    ];
  }, [movie, movieDescription]);

  usePageMetadata({
    title: movie ? `${movie.title}${movie.release_year ? ` (${movie.release_year})` : ""} | ReelBot` : "Movie Details | ReelBot",
    description: movie ? `Decide whether ${movie.title} is right for you, see where to watch, and find similar movies.` : "Movie details on ReelBot.",
    path: movie ? getMoviePath(movie) : "/",
    type: "video.movie",
    image: movie?.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : undefined,
    structuredData: detailStructuredData,
  });

  const jumpTo = useCallback((targetId) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - DETAIL_ANCHOR_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  const backToPick = () => navigate("/#pick-result", { state: { restorePickSession: true, scrollToPickResult: true } });

  if (loading) return <div className="loading-message"><span className="status-glyph" aria-hidden="true"></span><span>Loading movie details...</span></div>;
  if (error) return <p className="error-message">{error}</p>;
  if (!movie) return <p className="error-message">No data available.</p>;

  const reviewHighlights = movie.review_highlights || {};
  const showReviewSplit = !previewMode && (reviewHighlights.positive || reviewHighlights.negative);

  return (
    <div className="movie-details-page">
      <div className="movie-details-container detail-shell">
        <nav className="detail-topbar" aria-label="Breadcrumb">
          <div className="detail-breadcrumb">
            <Link to="/" className="detail-breadcrumb-link">Home</Link><span className="detail-breadcrumb-separator" aria-hidden="true">/</span>
            <Link to="/browse" className="detail-breadcrumb-link">Browse</Link><span className="detail-breadcrumb-separator" aria-hidden="true">/</span>
            <span className="detail-breadcrumb-current" aria-current="page">{movie.title}</span>
          </div>
          {canTryAnother ? <button type="button" className="detail-text-action detail-topbar-return" onClick={backToPick}>Back to your pick</button> : null}
        </nav>

        <section className="detail-hero" style={movie.backdrop_path ? { backgroundImage: `linear-gradient(90deg, rgba(8, 11, 22, 0.92), rgba(8, 11, 22, 0.78)), url(https://image.tmdb.org/t/p/original${movie.backdrop_path})` } : undefined}>
          <div className="detail-poster-column"><img src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "/placeholder.jpg"} alt={`${movie.title} poster`} className="detail-poster" /></div>
          <div className="detail-content-column">
            <div className="detail-eyebrow">{previewMode ? "Coming Soon" : "Movie Details"}</div>
            <h1 className="movie-title detail-title">{movie.title}</h1>
            {movie.tagline ? <p className="detail-tagline">{movie.tagline}</p> : null}
            <div className="detail-meta-strip">{metaItems.map((item) => <span key={item} className="detail-meta-pill">{item}</span>)}</div>
            <div className="detail-description-block"><div className="detail-description-label">Overview</div><p className="detail-description">{movieDescription}</p></div>
            <div className="detail-hero-actions detail-hero-actions--simplified">
              <button type="button" className="detail-trailer-cta" onClick={() => jumpTo("where-to-watch")}>Where to Watch</button>
              <TasteActionBar movie={movie} compact showSeenAction={false} showSkipAction={false} showVibeAction={false} />
              <button type="button" className="detail-text-action detail-text-action--hero" onClick={() => jumpTo("cast-and-details")}>Cast &amp; details <span aria-hidden="true">↓</span></button>
              {movie.trailer?.key ? <button type="button" className="detail-text-action detail-text-action--hero" onClick={() => { setIsTrailerOpen(true); trackProductEvent("trailer_clicked", { movie_id: Number(movie.id) }); }}>Watch trailer</button> : null}
              {canTryAnother ? <button type="button" className="detail-text-action detail-text-action--hero" onClick={backToPick}>Try another</button> : null}
            </div>
          </div>
        </section>

        <section className="detail-info-card detail-reelbot-take">
          <div className="detail-section-head"><div><div className="detail-description-label">Decision help</div><h2 className="detail-section-title">{reelbotTake.heading}</h2></div></div>
          <p className="detail-take-assessment">{reelbotTake.assessment}</p>
          <dl className="detail-take-fit">
            <div><dt>Good fit if</dt><dd>{reelbotTake.goodFit}</dd></div>
            <div><dt>Maybe not if</dt><dd>{reelbotTake.maybeNot}</dd></div>
          </dl>
          <button type="button" className="detail-text-action detail-take-cta" onClick={() => openAskReelbot({ prompt: `What should I know about ${movie.title}?` })}>Ask ReelBot about {movie.title} <span aria-hidden="true">→</span></button>
        </section>

        <WatchAvailability availability={movie.watch_providers} sectionId="where-to-watch" movie={movie} />
        <CastAndDetails movie={movie} />

        {showReviewSplit ? (
          <section className="detail-info-card detail-info-card--split">
            <div className="detail-section-head detail-section-head--facts"><div><h2 className="detail-section-title">Viewer Split</h2><p className="detail-secondary-text">What viewers respond to most — and what pushes others away.</p></div>{reviewHighlights.count ? <div className="results-count">{reviewHighlights.count} reviews</div> : null}</div>
            <div className="review-split-grid">
              {reviewHighlights.positive ? <article className="review-split-card review-split-card--positive"><div className="review-split-kicker">What lands</div><p className="review-split-quote">“{reviewHighlights.positive.content}”</p><div className="review-split-meta">{formatReviewMeta(reviewHighlights.positive, reviewHighlights.source)}</div></article> : null}
              {reviewHighlights.negative ? <article className="review-split-card review-split-card--negative"><div className="review-split-kicker">What misses</div><p className="review-split-quote">“{reviewHighlights.negative.content}”</p><div className="review-split-meta">{formatReviewMeta(reviewHighlights.negative, reviewHighlights.source)}</div></article> : null}
            </div>
          </section>
        ) : null}

        {displayedSimilarMovies.length ? (
          <section id="more-like-this" className="detail-info-card detail-anchor-target">
            <div className="detail-section-head"><h2 className="detail-section-title">More Like This</h2></div>
            <div className="similar-grid">
              {displayedSimilarMovies.map((similarMovie) => (
                <Link key={similarMovie.id} to={getMoviePath(similarMovie)} className="similar-card">
                  {similarMovie.poster_path ? <img src={`https://image.tmdb.org/t/p/w300${similarMovie.poster_path}`} alt={`${similarMovie.title} poster`} className="similar-poster" loading="lazy" decoding="async" /> : <div className="similar-poster similar-poster-placeholder">Poster unavailable</div>}
                  <div className="similar-title">{similarMovie.title}</div>
                  <div className="similar-year">{similarMovie.release_date ? new Date(similarMovie.release_date).getFullYear() : "TBA"}</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        <TrailerModal isOpen={isTrailerOpen} video={movie.trailer} movieTitle={movie.title} onClose={() => setIsTrailerOpen(false)} />
      </div>
    </div>
  );
}

export default MovieDetails;
