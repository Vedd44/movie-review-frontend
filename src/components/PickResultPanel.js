import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import RecommendationRationale from "./RecommendationRationale";
import TasteActionBar from "./TasteActionBar";
import ProviderBadgeRow from "./ProviderBadgeRow";
import useWatchProviderBadges from "../hooks/useWatchProviderBadges";
import { getMoviePath, getReleaseYear } from "../discovery";
import { getBackupCardMeta } from "../recommendationInsights";

const getAvailabilityStatus = (movie, providerEntry) =>
  movie?.availability_status || providerEntry?.availability_status || null;

const shouldShowAvailabilityChip = (status) => Boolean(status?.theater_only && status?.label);

function PickResultPanel({
  id,
  panelStatus = "idle",
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
  fallbackTitle,
  fallbackCopy,
  fallbackActionLabel,
  onFallbackAction,
  fallbackSecondaryActionLabel,
  fallbackSecondaryActionPath,
  primaryActionLabel = "",
  onPrimaryAction,
  showDetailLink = true,
  detailActionLabel = "View Details",
  refreshLabel = "Swap Pick",
  resetLabel = "Start fresh",
  backupTitle = "Similar picks, different vibes",
  backupCopy = "",
  onRefreshChoices,
  onResetChoices,
  refreshDisabled = false,
  resetDisabled = false,
  hideRefreshCta = false,
  refreshExhaustionMessage = "",
  recoveryTitle = "",
  recoveryMessage = "",
  refineVibeLabel = "Adjust your vibe",
  onRefineVibe,
  refineActions = [],
  onRefineAction,
  browsePath = "",
  hasActiveSession = false,
  showEmptyState = true,
  showSessionPlaceholder = false,
  showExpandedReasoning = false,
  refineStatusLabel = "",
  tasteActionProps = {},
}) {
  const visibleBackupMovies = useMemo(
    () => (Array.isArray(backupMovies) ? backupMovies.slice(0, 3) : []),
    [backupMovies]
  );
  const providerMap = useWatchProviderBadges(
    useMemo(() => [primaryMovie?.id, ...visibleBackupMovies.map((movie) => movie.id)].filter(Boolean), [primaryMovie, visibleBackupMovies])
  );
  const reelbotPickLinkState = { source: "reelbot_pick", restorePickSession: true };
  const hasPrimaryMovie = Boolean(primaryMovie);
  const shouldShowStandaloneLoading = loading && !hasPrimaryMovie;
  const shouldShowFallbackState = !hasPrimaryMovie && (panelStatus === "exhausted" || panelStatus === "error");
  const shouldShowInlineRecovery = hasPrimaryMovie && Boolean(recoveryTitle || recoveryMessage || onRefineVibe || browsePath);
  const availableRefineActions = Array.isArray(refineActions) ? refineActions.filter((action) => action?.id && action?.label) : [];
  const primaryAvailabilityStatus = getAvailabilityStatus(primaryMovie, providerMap[primaryMovie?.id]);
  const bestFitLabel = "Best fit";

  return (
    <div id={id} className={`pick-result-stage${primaryMovie ? " is-live" : ""}${!primaryMovie && !loading ? " pick-result-stage--empty" : ""}`}>
      {!hasPrimaryMovie && error && !shouldShowFallbackState ? <p className="error-message">{error}</p> : null}

      {!error && shouldShowStandaloneLoading ? (
        <div className="reelbot-loading-state">
          <span className="reelbot-loading-dot" aria-hidden="true"></span>
          <div className="reelbot-loading-copy">
            <p className="reelbot-loading-title">ReelBot is thinking…</p>
            <p className="detail-secondary-text reelbot-placeholder-copy">{loadingCopy}</p>
          </div>
        </div>
      ) : null}

      {hasPrimaryMovie ? (
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
              <div className="pick-primary-fit-row">
                <span className="pick-primary-fit-label">{bestFitLabel}</span>
                {rationale?.summaryLine ? <p className="pick-primary-hook">{rationale.summaryLine}</p> : null}
              </div>
              <div className="movie-card-meta">
                <span className="movie-card-chip">{getReleaseYear(primaryMovie.release_date)}</span>
                {primaryMovie.runtime ? <span className="movie-card-chip">{primaryMovie.runtime} min</span> : null}
                {primaryMovie.vote_average ? <span className="movie-card-chip">TMDB {primaryMovie.vote_average.toFixed(1)}</span> : null}
                {shouldShowAvailabilityChip(primaryAvailabilityStatus) ? (
                  <span className="movie-card-chip movie-card-chip--availability">{primaryAvailabilityStatus.label}</span>
                ) : null}
                {primaryMovie.seen ? (
                  <span className="movie-card-chip movie-card-chip--seen">Seen before</span>
                ) : null}
              </div>
              <ProviderBadgeRow badges={providerMap[primaryMovie.id]?.provider_badges} compact />
              <RecommendationRationale rationale={rationale} collapsible={!showExpandedReasoning} />

              <div className="pick-result-actions-block">
                <div className="pick-primary-actions">
                  <div className="pick-primary-action-row pick-primary-action-row--primary">
                    {primaryActionLabel && onPrimaryAction ? (
                      <button type="button" className="reelbot-inline-button reelbot-inline-button--solid pick-primary-main-action" onClick={onPrimaryAction}>
                        {primaryActionLabel}
                      </button>
                    ) : null}
                    {onRefreshChoices && !hideRefreshCta ? (
                      <button type="button" className="reelbot-inline-button pick-result-refresh" onClick={onRefreshChoices} disabled={refreshDisabled}>
                        {refreshLabel}
                      </button>
                    ) : null}
                    {onResetChoices ? (
                      <button
                        type="button"
                        className="reelbot-inline-button reelbot-inline-button--secondary pick-result-reset"
                        onClick={onResetChoices}
                        disabled={resetDisabled}
                      >
                        {resetLabel}
                      </button>
                    ) : null}
                  </div>
                  {refreshExhaustionMessage ? (
                    <p className="pick-refresh-hint">{refreshExhaustionMessage}</p>
                  ) : null}
                  {showDetailLink ? (
                    <div className="pick-primary-action-row pick-primary-action-row--detail">
                      <Link to={getMoviePath(primaryMovie)} state={reelbotPickLinkState} className="pick-primary-detail-link">
                        {detailActionLabel}
                      </Link>
                    </div>
                  ) : null}
                  <div className="pick-personal-actions-block">
                    <div className="pick-personal-actions-label">Actions</div>
                    <TasteActionBar
                      movie={primaryMovie}
                      vibeLabel={vibeLabel}
                      compact
                      className="pick-taste-actions"
                      showVibeAction={false}
                      {...tasteActionProps}
                    />
                  </div>
                  {rationale?.tasteCue ? <p className="pick-taste-cue detail-secondary-text">{rationale.tasteCue}</p> : null}
                  {availableRefineActions.length && onRefineAction ? (
                  <div className="pick-refine-panel">
                      <div className="pick-refine-label">Refine this</div>
                      <div className="pick-refine-grid">
                        {availableRefineActions.map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            className="reelbot-inline-button pick-refine-button"
                            onClick={() => onRefineAction(action)}
                            disabled={refreshDisabled}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                      {refineStatusLabel ? <p className="pick-refine-status detail-secondary-text">{refineStatusLabel}</p> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </article>

          {shouldShowInlineRecovery ? (
            <div className="pick-session-recovery">
              {recoveryTitle ? <p className="pick-session-recovery-title">{recoveryTitle}</p> : null}
              {recoveryMessage ? <p className="pick-session-recovery-copy">{recoveryMessage}</p> : null}
              <div className="pick-session-recovery-actions">
                {onRefineVibe ? (
                  <button type="button" className="reelbot-inline-button pick-result-refresh" onClick={onRefineVibe}>
                    {refineVibeLabel}
                  </button>
                ) : null}
                {browsePath ? (
                  <Link to={browsePath} className="reelbot-inline-button">
                    Browse movies
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {visibleBackupMovies.length ? (
            <section className="pick-backups-block">
              <div className="pick-backups-head">
                <div>
                  <h3 className="pick-backups-title">{backupTitle}</h3>
                  {backupCopy ? <p className="pick-backups-copy">{backupCopy}</p> : null}
                </div>
              </div>

              <div className="pick-backup-strip">
                {visibleBackupMovies.map((movie, index) => {
                  const backupMeta = getBackupCardMeta(movie, index);
                  const availabilityStatus = getAvailabilityStatus(movie, providerMap[movie.id]);

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
                        {movie.seen ? (
                          <div className="pick-backup-status">
                            <span className="movie-card-chip movie-card-chip--seen">Seen before</span>
                          </div>
                        ) : null}
                        {shouldShowAvailabilityChip(availabilityStatus) ? (
                          <div className="pick-backup-status">
                            <span className="movie-card-chip movie-card-chip--availability">{availabilityStatus.label}</span>
                          </div>
                        ) : null}
                        {backupMeta.shortLine ? <p className="pick-backup-reason detail-secondary-text">{backupMeta.shortLine}</p> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {!error && !shouldShowStandaloneLoading && !primaryMovie && showSessionPlaceholder ? (
        <div className="reelbot-loading-state pick-session-placeholder" role="status">
          <span className="reelbot-loading-dot" aria-hidden="true"></span>
          <div className="reelbot-loading-copy">
            <p className="reelbot-loading-title">Restoring your pick…</p>
            <p className="detail-secondary-text reelbot-placeholder-copy">
              Your active ReelBot session is still here.
            </p>
          </div>
        </div>
      ) : null}

      {!error && !loading && !primaryMovie && !hasActiveSession && showEmptyState ? (
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

      {!loading && shouldShowFallbackState ? (
        <div className="pick-empty-state pick-empty-state--result pick-empty-state-soft">
          {fallbackTitle ? <h3 className="pick-empty-title">{fallbackTitle}</h3> : null}
          {fallbackCopy ? <p className="pick-result-copy detail-secondary-text">{fallbackCopy}</p> : null}
          <div className="pick-empty-actions">
            {onFallbackAction && fallbackActionLabel ? (
              <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={onFallbackAction}>
                {fallbackActionLabel}
              </button>
            ) : null}
            {fallbackSecondaryActionLabel && fallbackSecondaryActionPath ? (
              <Link to={fallbackSecondaryActionPath} className="reelbot-inline-button">
                {fallbackSecondaryActionLabel}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PickResultPanel;
