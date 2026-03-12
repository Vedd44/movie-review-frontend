import React from "react";
import { Link } from "react-router-dom";
import RecommendationRationale from "./RecommendationRationale";
import TasteActionBar from "./TasteActionBar";
import { getMoviePath, getReleaseYear } from "../discovery";

function PickResultPanel({
  id,
  loading,
  error,
  rationale,
  summary,
  primaryMovie,
  backupMovies = [],
  vibeLabel = "",
  loadingCopy,
  emptyCopy,
  refreshLabel = "Swap Pick",
  backupTitle = "Other good options",
  onRefreshChoices,
  refreshDisabled = false,
  showExpandedReasoning = false,
}) {
  return (
    <div id={id} className={`pick-result-stage${primaryMovie ? " is-live" : ""}${!primaryMovie && !loading ? " pick-result-stage--empty" : ""}`}>
      {error ? <p className="error-message">{error}</p> : null}

      {!error && loading ? (
        <div className="reelbot-loading-state">
          <span className="reelbot-loading-dot" aria-hidden="true"></span>
          <p className="detail-secondary-text reelbot-placeholder-copy">{loadingCopy}</p>
        </div>
      ) : null}

      {!error && !loading && primaryMovie ? (
        <>
          {rationale?.contextAnchor ? <p className="pick-context-anchor">{rationale.contextAnchor}</p> : null}

          <div className="pick-result-header">
            <div>
              <h3 className="pick-result-title">{rationale?.heading || "ReelBot’s Pick"}</h3>
            </div>
            {rationale?.confidenceLabel ? <div className="recommendation-confidence-pill pick-result-confidence">{rationale.confidenceLabel}</div> : null}
          </div>

          <article className="pick-primary-card pick-primary-card--hero">
            <Link to={getMoviePath(primaryMovie)} className="pick-primary-poster-link">
              {primaryMovie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w300${primaryMovie.poster_path}`}
                  alt={primaryMovie.title}
                  className="pick-primary-poster"
                />
              ) : (
                <div className="pick-primary-poster pick-primary-poster--placeholder">Poster unavailable</div>
              )}
            </Link>
            <div className="pick-primary-content">
              <h3 className="pick-primary-title">
                <Link to={getMoviePath(primaryMovie)} className="movie-title-link">
                  {primaryMovie.title}
                </Link>
              </h3>
              <div className="movie-card-meta">
                <span className="movie-card-chip">{getReleaseYear(primaryMovie.release_date)}</span>
                {primaryMovie.runtime ? <span className="movie-card-chip">{primaryMovie.runtime} min</span> : null}
                {primaryMovie.vote_average ? <span className="movie-card-chip">TMDB {primaryMovie.vote_average.toFixed(1)}</span> : null}
                {rationale?.fitLabel ? <span className="movie-card-chip movie-card-chip--accent">{rationale.fitLabel}</span> : null}
              </div>
              {summary ? <p className="pick-result-summary detail-secondary-text">{summary}</p> : null}
              <div className="pick-rationale-divider" aria-hidden="true"></div>
              <RecommendationRationale rationale={rationale} collapsible={!showExpandedReasoning} />

              <div className="pick-result-actions-block">
                <div className="pick-primary-actions">
                  <div className="pick-primary-action-row pick-primary-action-row--primary">
                    <Link to={getMoviePath(primaryMovie)} className="card-link pick-primary-detail-link">
                      View Details
                    </Link>
                    {onRefreshChoices ? (
                      <button type="button" className="reelbot-inline-button pick-result-refresh" onClick={onRefreshChoices} disabled={refreshDisabled}>
                        {refreshLabel}
                      </button>
                    ) : null}
                  </div>
                  <div className="pick-personal-actions-block">
                    <div className="pick-personal-actions-label">Your actions</div>
                    <TasteActionBar movie={primaryMovie} vibeLabel={vibeLabel} compact className="pick-taste-actions" showVibeAction={false} />
                  </div>
                  {rationale?.tasteCue ? <p className="pick-taste-cue detail-secondary-text">{rationale.tasteCue}</p> : null}
                </div>
              </div>
            </div>
          </article>

          {backupMovies.length ? (
            <section className="pick-backups-block">
              <div className="pick-backups-head">
                <div>
                  <h3 className="pick-backups-title">{backupTitle}</h3>
                  <p className="section-subtitle pick-backups-copy">Not feeling the first pick? Here are a few strong alternatives.</p>
                </div>
              </div>

              <div className="pick-backup-strip">
                {backupMovies.map((movie) => (
                  <article key={movie.id} className="pick-backup-card">
                    <Link to={getMoviePath(movie)} className="pick-backup-poster-link" aria-label={`Open ${movie.title}`}>
                      {movie.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                          alt={movie.title}
                          className="pick-backup-poster"
                        />
                      ) : (
                        <div className="pick-backup-poster pick-backup-poster--placeholder">Poster unavailable</div>
                      )}
                    </Link>
                    <div className="pick-backup-meta">
                      {movie.backupRole ? <div className="pick-backup-role">{movie.backupRole}</div> : null}
                      <h4 className="pick-backup-title">
                        <Link to={getMoviePath(movie)} className="movie-title-link">
                          {movie.title}
                        </Link>
                      </h4>
                      <p className="pick-backup-year">{getReleaseYear(movie.release_date)}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {!error && !loading && !primaryMovie ? <p className="detail-secondary-text pick-result-copy">{emptyCopy}</p> : null}
    </div>
  );
}

export default PickResultPanel;
