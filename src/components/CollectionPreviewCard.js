import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../discovery";
import collectionMovieManifest from "../generatedCollectionPreviews.json";

export default function CollectionPreviewCard({ collection, compact = false, note = "" }) {
  const [previewMovies, setPreviewMovies] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const slugs = collection.movies.slice(0, 3);
    const cached = slugs.map((slug) => collectionMovieManifest[slug]).filter((movie) => movie?.poster_path);
    if (cached.length === slugs.length) {
      setPreviewMovies(cached);
      return () => { cancelled = true; };
    }
    Promise.allSettled(slugs.map((slug) => collectionMovieManifest[slug] ? Promise.resolve({ data: collectionMovieManifest[slug] }) : axios.get(`${API_BASE_URL}/movies/resolve/${encodeURIComponent(slug)}`)))
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
        <h2>{collection.title}</h2>
        {note ? <p className="collection-preview-note">{note}</p> : !compact ? <p>{collection.description}</p> : null}
        <span className="collection-preview-cta">Explore collection <span aria-hidden="true">→</span></span>
      </div>
    </Link>
  );
}

