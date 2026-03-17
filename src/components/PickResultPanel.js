import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import RecommendationRationale from "./RecommendationRationale";
import TasteActionBar from "./TasteActionBar";
import ProviderBadgeRow from "./ProviderBadgeRow";
import useWatchProviderBadges from "../hooks/useWatchProviderBadges";
import { getMoviePath, getReleaseYear } from "../discovery";
import { getBackupCardMeta } from "../recommendationInsights";

function PickResultPanel({
  id,
  loading,
  error,
  rationale,
  primaryMovie,
  backupMovies = [],
  vibeLabel = "",
  loadingCopy,
  emptyTitle,
  emptyCopy,
  emptyActionLabel,
  onEmptyAction,
  refreshLabel = "Swap Pick",
  backupTitle = "Similar picks, different vibes",
  onRefreshChoices,
  refreshDisabled = false,
  showExpandedReasoning = false,
}) {
  const providerMap = useWatchProviderBadges(
    useMemo(() => [primaryMovie?.id, ...backupMovies.map((movie) => movie.id)].filter(Boolean), [primaryMovie, backupMovies])
  );
  const confidenceStars = rationale?.confidenceStars || "★★★★☆";
  const reelbotPickLinkState = { source: "reelbot_pick" };

  return (
    <div id={id} className={`pick-result-stage${primaryMovie ? " is-live" : ""}${!primaryMovie && !loading ? " pick-result-stage--empty" : ""}`}>
      {error ? <p className="error-message">{error}</p> : null}

      {!error && loading ? (
        <div className="reelbot-loading-state">
          <span className="reelbot-loading-dot" aria-hidden="true"></span>
          <div className="reelbot-loading-copy">
            <p className="reelbot-loading-title">ReelBot is thinking…</p>
            <p className="detail-secondary-text reelbot-placeholder-copy">{loadingCopy}</p>
          </div>
        </div>
      ) : null}

      {!error && !loading && primaryMovie ? (
        <>
          <article className="pick-primary-card pick-primary-card--hero">
            <Link to={getMoviePath(primaryMovie)} state={reelbotPickLinkState} className="pick-primary-poster-link">
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
                <Link to={getMoviePath(primaryMovie)} state={reelbotPickLinkState} className="movie-title-link">
                  {primaryMovie.title}
                </Link>
              </h3>
              {rationale?.confidenceLabel ? (
                <div className="pick-result-confidence-detail pick-result-confidence-detail--inline">
                  <span className="pick-result-confidence-text">Confidence</span>
                  <span className="pick-result-confidence-stars" aria-label={`Confidence ${rationale.confidenceLabel}`}>
                    {confidenceStars}
                  </span>
                </div>
              ) : null}
              <div className="movie-card-meta">
                <span className="movie-card-chip">{getReleaseYear(primaryMovie.release_date)}</span>
                {primaryMovie.runtime ? <span className="movie-card-chip">{primaryMovie.runtime} min</span> : null}
                {primaryMovie.vote_average ? <span className="movie-card-chip">TMDB {primaryMovie.vote_average.toFixed(1)}</span> : null}
              </div>
              <ProviderBadgeRow badges={providerMap[primaryMovie.id]?.provider_badges} compact />
              <RecommendationRationale rationale={rationale} collapsible={!showExpandedReasoning} />

              <div className="pick-result-actions-block">
                <div className="pick-primary-actions">
                  <div className="pick-primary-action-row pick-primary-action-row--primary">
                    <Link to={getMoviePath(primaryMovie)} state={reelbotPickLinkState} className="card-link pick-primary-detail-link">
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
                  <p className="pick-backups-eyebrow">Same vibe, different angle</p>
                </div>
              </div>

              <div className="pick-backup-strip">
                {backupMovies.map((movie, index) => {
                  const backupMeta = getBackupCardMeta(movie, index);

                  return (
                    <article key={movie.id} className="pick-backup-card">
                      <Link to={getMoviePath(movie)} state={reelbotPickLinkState} className="pick-backup-poster-link" aria-label={`Open ${movie.title}`}>
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
                        <h4 className="pick-backup-title">
                          <Link to={getMoviePath(movie)} state={reelbotPickLinkState} className="movie-title-link">
                            {movie.title}
                          </Link>
                        </h4>
                        {backupMeta.shortLine ? <p className="pick-backup-reason detail-secondary-text">{backupMeta.shortLine}</p> : null}
                        {backupMeta.tags.length ? <p className="pick-backup-tags">{backupMeta.tags.join(" • ")}</p> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {!error && !loading && !primaryMovie ? (
        <div className="pick-empty-state pick-empty-state--result">
          {emptyTitle ? <h3 className="pick-empty-title">{emptyTitle}</h3> : null}
          <p className="pick-result-copy detail-secondary-text">{emptyCopy}</p>
          {onEmptyAction && emptyActionLabel ? (
            <div className="pick-empty-actions">
              <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={onEmptyAction}>
                {emptyActionLabel}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default PickResultPanel;
