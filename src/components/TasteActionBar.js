import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import useTasteProfile from "../hooks/useTasteProfile";

function TasteActionBar({
  movie,
  vibeLabel = "",
  compact = false,
  className = "",
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
  const { user, openAuthPrompt } = useAuth();
  const [feedback, setFeedback] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const tasteState = getMovieState(movie?.id, vibeLabel);
  const classes = `taste-action-bar${compact ? " taste-action-bar--compact" : ""}${className ? ` ${className}` : ""}`;

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

  const isBusy = Boolean(pendingAction);

  const handleAction = async (actionKey, handler) => {
    if (isBusy) {
      return;
    }

    setPendingAction(actionKey);
    setActionError("");

    try {
      await handler();
      if (typeof onInteraction === "function") {
        onInteraction(actionKey);
      }
      setFeedback(feedbackMap[actionKey] || "Saved");
      if (!user && actionKey === "watchlist") {
        openAuthPrompt("save_movie");
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
          className={`taste-action-button${tasteState.inWatchlist ? " is-active" : ""}`}
          onClick={() => handleAction("watchlist", () => actions.toggleWatchlist(movie))}
          disabled={isBusy}
          aria-pressed={tasteState.inWatchlist}
        >
          {pendingAction === "watchlist" ? "Saving..." : tasteState.inWatchlist ? savedLabel : saveLabel}
        </button>
      ) : null}
      {showSeenAction ? (
        <button
          type="button"
          className={`taste-action-button${tasteState.seen ? " is-active" : ""}`}
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
          className={`taste-action-button${tasteState.skipped ? " is-active" : ""}`}
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
          className={`taste-action-button${tasteState.likedVibe ? " is-active" : ""}`}
          onClick={() => handleAction("vibe", () => actions.toggleLikedVibe(movie, vibeLabel))}
          disabled={isBusy}
          aria-pressed={tasteState.likedVibe}
        >
          {pendingAction === "vibe" ? "Saving..." : tasteState.likedVibe ? "Vibe Saved" : "Like this Vibe"}
        </button>
      ) : null}
      {pendingAction && user && isCloudSyncing ? <span className="taste-action-feedback">Saving your changes...</span> : null}
      {actionError ? <span className="taste-action-feedback taste-action-feedback--error">{actionError}</span> : null}
      {feedback ? <span className="taste-action-feedback">{feedback}</span> : null}
    </div>
  );
}

export default TasteActionBar;
