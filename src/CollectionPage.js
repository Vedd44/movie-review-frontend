import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import axios from "axios";
import "./App.css";
import { COLLECTIONS, COLLECTION_CATEGORIES, getCollection } from "./collections";
import { API_BASE_URL, formatMovieDate, getMoviePath, getReleaseYear } from "./discovery";
import { buildBreadcrumbJsonLd, buildItemListJsonLd, usePageMetadata } from "./seo";
import { useAskReelbotPageContext } from "./context/AskReelbotContext";

export function CollectionPreviewCard({ collection, compact = false }) {
  const [previewMovies, setPreviewMovies] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(collection.movies.slice(0, 3).map((slug) => axios.get(`${API_BASE_URL}/movies/resolve/${encodeURIComponent(slug)}`)))
      .then((results) => {
        if (cancelled) return;
        setPreviewMovies(results.filter((result) => result.status === "fulfilled" && result.value?.data?.poster_path).map((result) => result.value.data));
      });
    return () => { cancelled = true; };
  }, [collection]);

  return (
    <Link to={`/collections/${collection.slug}`} className={`collection-preview-card${compact ? " collection-preview-card--compact" : ""}`}>
      <div className="collection-preview-posters" aria-hidden="true">
        {previewMovies.map((movie, index) => (
          <img key={movie.id} src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} alt="" className={`collection-preview-poster collection-preview-poster--${index + 1}`} width="300" height="450" loading="lazy" decoding="async" />
        ))}
        <span className="collection-preview-shade"></span>
      </div>
      <div className="collection-preview-copy">
        <span className="detail-description-label">{collection.eyebrow}</span>
        <h2>{collection.title}</h2>
        {!compact ? <p>{collection.description}</p> : null}
        <span className="collection-preview-cta">Explore collection <span aria-hidden="true">→</span></span>
      </div>
    </Link>
  );
}

function CollectionCard({ movie }) {
  return (
    <article className="movie-card movie-card--browse collection-movie-card">
      <div className="movie-poster-shell">
        <Link to={getMoviePath(movie)} className="movie-poster-link" aria-label={`Open ${movie.title}`}>
          {movie.poster_path ? (
            <img src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} alt={movie.title} className="movie-poster" width="300" height="450" loading="lazy" decoding="async" />
          ) : <div className="no-poster">Poster unavailable</div>}
        </Link>
      </div>
      <div className="movie-card-content">
        <div className="movie-card-meta">
          <span className="movie-card-chip">{getReleaseYear(movie.release_date)}</span>
          {movie.vote_average ? <span className="movie-card-chip">TMDB {Number(movie.vote_average).toFixed(1)}</span> : null}
        </div>
        <h2 className="movie-card-title"><Link to={getMoviePath(movie)} className="movie-title-link">{movie.title}</Link></h2>
        <p className="movie-card-date">{formatMovieDate(movie.release_date)}</p>
        
      </div>
    </article>
  );
}

export function CollectionsIndex() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);

  const filteredCollections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return COLLECTIONS.filter((collection) => {
      const categoryMatch = activeCategory === "All" || collection.categories?.includes(activeCategory);
      const searchMatch = !normalizedQuery || [collection.title, collection.description, collection.eyebrow]
        .filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, query]);

  useEffect(() => { setVisibleCount(12); }, [activeCategory, query]);

  const structuredData = useMemo(() => [
    buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Collections", path: "/collections" }]),
    buildItemListJsonLd(COLLECTIONS.map((item) => ({ name: item.title, path: `/collections/${item.slug}` }))),
  ], []);

  usePageMetadata({
    title: "Movie Collections by Mood, Genre & More | ReelBot",
    description: "Browse movie collections for every kind of night, from ’90s action and sci-fi to thrillers, comfort movies and more. Find something worth watching with ReelBot.",
    path: "/collections",
    structuredData,
  });

  return (
    <div className="browse-page collections-page">
      <div className="container browse-shell">
        <section className="collection-hero">
          <div className="browse-kicker">ReelBot Collections</div>
          <h1 className="browse-title">Sometimes you just need somewhere to start.</h1>
          <p className="collection-dek">Movies grouped by mood, genre, era, and whatever else makes a good night in.</p>
        </section>
        <section className="collections-discovery" aria-label="Find a collection">
          <div className="collections-filter-row">
            <div className="collections-filter-chips" role="group" aria-label="Filter collections">
              {COLLECTION_CATEGORIES.map((category) => (
                <button key={category} type="button" className={`collections-filter-chip${activeCategory === category ? " is-active" : ""}`} onClick={() => setActiveCategory(category)}>
                  {category}
                </button>
              ))}
            </div>
            <label className="collections-search">
              <span className="sr-only">Search collections</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search collections" />
            </label>
          </div>
          <p className="collections-result-count">{filteredCollections.length} {filteredCollections.length === 1 ? "collection" : "collections"}</p>
        </section>
        <div className="collections-index-grid">
          {filteredCollections.slice(0, visibleCount).map((collection) => <CollectionPreviewCard key={collection.slug} collection={collection} />)}
        </div>
        {!filteredCollections.length ? <div className="collections-empty">No collections match that search.</div> : null}
        {visibleCount < filteredCollections.length ? (
          <div className="collections-load-more-row">
            <button type="button" className="browse-library-link collections-load-more" onClick={() => setVisibleCount((count) => count + 12)}>Load more collections</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CollectionPage() {
  const { collectionSlug } = useParams();
  const collection = getCollection(collectionSlug);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collection) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled(collection.movies.filter((slug) => slug !== collection.anchorMovie).map((slug) => axios.get(`${API_BASE_URL}/movies/resolve/${encodeURIComponent(slug)}`)))
      .then((results) => {
        if (cancelled) return;
        setMovies(results.filter((result) => result.status === "fulfilled" && result.value?.data?.id).map((result) => result.value.data));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [collection]);

  const structuredData = useMemo(() => collection ? [
    buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Collections", path: "/collections" },
      { name: collection.title, path: `/collections/${collection.slug}` },
    ]),
    movies.length ? buildItemListJsonLd(movies.map((movie) => ({ name: movie.title, path: getMoviePath(movie) }))) : null,
  ].filter(Boolean) : [], [collection, movies]);

  usePageMetadata({
    title: collection ? `${collection.title} | ReelBot` : "Movie Collections | ReelBot",
    description: collection?.description,
    path: collection ? `/collections/${collection.slug}` : "/collections",
    robots: collection ? "index,follow" : "noindex,follow",
    structuredData,
  });

  const pageContext = useMemo(() => collection ? ({
    page: "collection",
    collection: { slug: collection.slug, title: collection.title, prompt: collection.prompt },
    visibleMovieIds: movies.map((movie) => movie.id).filter(Boolean),
  }) : null, [collection, movies]);
  useAskReelbotPageContext(pageContext);

  if (!collection) return <Navigate to="/collections" replace />;

  return (
    <div className="browse-page collections-page">
      <div className="container browse-shell">
        <nav className="collection-breadcrumb" aria-label="Breadcrumb"><Link to="/collections">Collections</Link><span> / </span><span>{collection.title}</span></nav>
        <section className="collection-hero">
          <div className="browse-kicker">{collection.eyebrow}</div>
          <h1 className="browse-title">{collection.title}</h1>
          <p className="collection-dek">{collection.description}</p>
        </section>

        {loading ? (
          <div className="loading-message"><span className="status-glyph" aria-hidden="true"></span><span>Building this collection...</span></div>
        ) : (
          <div className="movie-list collection-movie-list">
            {movies.map((movie) => <CollectionCard key={movie.id} movie={movie} />)}
          </div>
        )}

        <div className="collection-back-row">
          <Link to="/collections" className="browse-library-link">← Back to collections</Link>
        </div>
      </div>
    </div>
  );
}
