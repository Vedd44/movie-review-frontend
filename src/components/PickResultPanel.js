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
  refreshLabel = "Show new options",
  backupTitle = "Backup picks if the first one doesn’t land",
  backupCopy = "A few strong backups for the same setup.",
  onRefreshChoices,
  refreshDisabled = false,
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
          <RecommendationRationale rationale={rationale} summary={summary} />

          <article className="pick-primary-card">
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
              <div className="detail-description-label pick-primary-kicker">Main pick</div>
              <div className="movie-card-meta">
                <span className="movie-card-chip">{getReleaseYear(primaryMovie.release_date)}</span>
                {primaryMovie.vote_average ? <span className="movie-card-chip">TMDB {primaryMovie.vote_average.toFixed(1)}</span> : null}
              </div>
              <h3 className="pick-primary-title">
                <Link to={getMoviePath(primaryMovie)} className="movie-title-link">
                  {primaryMovie.title}
                </Link>
              </h3>
              <p className="pick-primary-reason">{primaryMovie.reason}</p>
              <p className="pick-primary-overview">{primaryMovie.overview}</p>
              <div className="pick-primary-actions">
                <div className="pick-primary-action-row">
                  <Link to={getMoviePath(primaryMovie)} className="card-link">
                    Open this pick
                  </Link>
                  {onRefreshChoices ? (
                    <button type="button" className="reelbot-inline-button pick-result-refresh" onClick={onRefreshChoices} disabled={refreshDisabled}>
                      {refreshLabel}
                    </button>
                  ) : null}
                </div>
                <TasteActionBar movie={primaryMovie} vibeLabel={vibeLabel} compact className="pick-taste-actions" />
              </div>
            </div>
          </article>

          {backupMovies.length ? (
            <section className="pick-backups-block">
              <div className="pick-backups-head">
                <div>
                  <div className="detail-description-label">Backup Picks</div>
                  <h3 className="pick-backups-title">{backupTitle}</h3>
                  <p className="detail-secondary-text">{backupCopy}</p>
                </div>
              </div>

              <div className="pick-alternates-grid">
                {backupMovies.map((movie) => (
                  <article key={movie.id} className="pick-alternate-card">
                    <Link to={getMoviePath(movie)} className="pick-alternate-poster-link" aria-label={`Open ${movie.title}`}>
                      {movie.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                          alt={movie.title}
                          className="pick-alternate-poster"
                        />
                      ) : (
                        <div className="pick-alternate-poster pick-alternate-poster--placeholder">Poster unavailable</div>
                      )}
                    </Link>
                    <div className="pick-alternate-body">
                      <div className="pick-alternate-head">
                        <div>
                          <h3 className="pick-alternate-title">
                            <Link to={getMoviePath(movie)} className="movie-title-link">
                              {movie.title}
                            </Link>
                          </h3>
                          <div className="pick-alternate-meta">
                            <span className="movie-card-chip">{getReleaseYear(movie.release_date)}</span>
                            {movie.vote_average ? <span className="movie-card-chip">TMDB {movie.vote_average.toFixed(1)}</span> : null}
                          </div>
                        </div>
                      </div>
                      <p className="pick-alternate-reason">{movie.reason}</p>
                      <TasteActionBar movie={movie} vibeLabel={vibeLabel} compact className="pick-taste-actions" />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {!error && !loading && !primaryMovie ? (
        <div className="pick-empty-state-soft">
          <p className="pick-empty-note detail-secondary-text">{emptyCopy}</p>
        </div>
      ) : null}
    </div>
  );
}

export default PickResultPanel;
