import React from "react";
import { getReleaseYear } from "../discovery";

export default function MovieCardMeta({ movie, children }) {
  const rating = Number(movie?.vote_average ?? movie?.rating);
  const runtime = Number(movie?.runtime);
  const year = movie?.release_year || getReleaseYear(movie?.release_date);
  return <div className="movie-card-meta movie-card-facts">
    <span className="movie-card-chip">{year}</span>
    {rating > 0 ? <span className="movie-card-chip" aria-label={`TMDB audience rating ${rating.toFixed(1)} out of 10`}>TMDB {rating.toFixed(1)}</span> : null}
    {runtime > 0 ? <span className="movie-card-chip">{runtime} min</span> : null}
    {children}
  </div>;
}
