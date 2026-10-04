import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import useTasteProfile from "../hooks/useTasteProfile";
import { trackProductEvent } from "../analytics";

function TasteActionBar({
  movie,
  vibeLabel = "",
  compact = false,
  disabled = false,
  className = "",
  buttonClassName = "",
  showSaveAction = true,
  showSeenAction = true,
  showSkipAction = true,
  showVibeAction = true,
  saveLabel = "Save",
  savedLabel = "Saved",
  seenLabel = "Seen",
  skipLabel = "Not for me",
  skipActiveLabel = "Not for me",
  onInteraction = null,
}) {
  const { actions, getMovieState, isCloudSyncing } = useTasteProfile();
  const { user, requestMovieSaveAuth } = useAuth();
  const [feedback, setFeedback] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const tasteState = getMovieState(movie?.id, vibeLabel);
  const classes = `taste-action-bar${compact ? " taste-action-bar--compact" : ""}${className ? ` ${className}` : ""}`;
  const actionButtonClasses = `taste-action-button${buttonClassName ? ` ${buttonClassName}` : ""}`;

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setFeedback(""), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  useEffect(() => {
    if (!actionError) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setActionError(""), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [actionError]);

  const feedbackMap = useMemo(
    () => ({
      watchlist: tasteState.inWatchlist ? "Removed from Watchlist" : "Saved",
      seen: tasteState.seen ? "Removed from Seen" : "Marked seen",
      hidden: tasteState.skipped ? "Removed from hidden" : "Hidden from picks",
      vibe: tasteState.likedVibe ? "Removed saved vibe" : "Saved this vibe",
    }),
    [tasteState.inWatchlist, tasteState.likedVibe, tasteState.seen, tasteState.skipped]
  );

  if (!movie?.id) {
    return null;
  }

  const isBusy = Boolean(pendingAction) || disabled;

  const handleAction = async (actionKey, handler) => {
    if (isBusy) {
      return;
    }

    if (!user && actionKey === "watchlist") {
      trackProductEvent("save_clicked", { authenticated: false, movie_id: Number(movie.id) });
      requestMovieSaveAuth(movie);
      return;
    }

    setPendingAction(actionKey);
    setActionError("");

    try {
      await handler();
      const eventName = actionKey === "watchlist"
        ? (tasteState.inWatchlist ? "movie_unsaved" : "movie_saved")
        : actionKey === "seen"
          ? (tasteState.seen ? "movie_unwatched" : "movie_watched")
          : actionKey === "hidden"
            ? (tasteState.skipped ? "not_for_me_removed" : "not_for_me_added")
            : "";
      if (eventName) trackProductEvent(eventName, { authenticated: Boolean(user), movie_id: Number(movie.id) });
      if (typeof onInteraction === "function") {
        onInteraction(actionKey, { active: actionKey === "hidden" ? !tasteState.skipped : actionKey === "seen" ? !tasteState.seen : actionKey === "watchlist" ? !tasteState.inWatchlist : !tasteState.likedVibe });
      }
      // The Save button itself reflects watchlist state (Save/Saved), so avoid a second
      // success line that changes the action-row height and knocks controls out of alignment.
      if (actionKey !== "watchlist") {
        setFeedback(feedbackMap[actionKey] || "Saved");
      }
    } catch (error) {
      console.error("Error updating ReelBot taste state:", error);
      setActionError("Could not save that change. Try again.");
    } finally {
      setPendingAction("");
    }
  };

  return (
    <div className={classes}>
      {showSaveAction ? (
        <button
          type="button"
          className={`${actionButtonClasses}${tasteState.inWatchlist ? " is-active" : ""}`}
          onClick={() => handleAction("watchlist", () => actions.toggleWatchlist(movie))}
          disabled={isBusy}
          aria-pressed={tasteState.inWatchlist}
        >
          {pendingAction === "watchlist" ? "Saving…" : tasteState.inWatchlist ? savedLabel : saveLabel}
        </button>
      ) : null}
      {showSeenAction ? (
        <button
          type="button"
          className={`${actionButtonClasses}${tasteState.seen ? " is-active" : ""}`}
          onClick={() => handleAction("seen", () => actions.toggleSeen(movie))}
          disabled={isBusy}
          aria-pressed={tasteState.seen}
        >
          {pendingAction === "seen" ? "Updating..." : seenLabel}
        </button>
      ) : null}
      {showSkipAction ? (
        <button
          type="button"
          className={`${actionButtonClasses}${tasteState.skipped ? " is-active" : ""}`}
          onClick={() => handleAction("hidden", () => actions.toggleSkipped(movie))}
          disabled={isBusy}
          aria-pressed={tasteState.skipped}
        >
          {pendingAction === "hidden" ? "Updating..." : tasteState.skipped ? skipActiveLabel : skipLabel}
        </button>
      ) : null}
      {showVibeAction && vibeLabel ? (
        <button
          type="button"
          className={`${actionButtonClasses}${tasteState.likedVibe ? " is-active" : ""}`}
          onClick={() => handleAction("vibe", () => actions.toggleLikedVibe(movie, vibeLabel))}
          disabled={isBusy}
          aria-pressed={tasteState.likedVibe}
        >
          {pendingAction === "vibe" ? "Saving…" : tasteState.likedVibe ? "Vibe Saved" : "Like this Vibe"}
        </button>
      ) : null}
      {pendingAction && user && isCloudSyncing && pendingAction !== "watchlist" ? <span className="taste-action-feedback">Saving…</span> : null}
      {actionError ? <span className="taste-action-feedback taste-action-feedback--error">{actionError}</span> : null}
      {feedback ? <span className="taste-action-feedback">{feedback}</span> : null}
    </div>
  );
}

export default TasteActionBar;
