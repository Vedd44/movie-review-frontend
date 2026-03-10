import React, { useEffect, useMemo, useState } from "react";
import useTasteProfile from "../hooks/useTasteProfile";

function TasteActionBar({ movie, vibeLabel = "", compact = false, className = "" }) {
  const { actions, getMovieState } = useTasteProfile();
  const [feedback, setFeedback] = useState("");
  const tasteState = getMovieState(movie?.id, vibeLabel);
  const classes = `taste-action-bar${compact ? " taste-action-bar--compact" : ""}${className ? ` ${className}` : ""}`;

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setFeedback(""), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const feedbackMap = useMemo(
    () => ({
      watchlist: tasteState.inWatchlist ? "Removed from Watchlist" : "Saved to Watchlist",
      seen: tasteState.seen ? "Removed from Seen" : "Marked as Seen",
      hidden: tasteState.skipped ? "Removed from Hidden" : "Hidden from picks",
      vibe: tasteState.likedVibe ? "Removed saved vibe" : "Saved this vibe",
    }),
    [tasteState.inWatchlist, tasteState.likedVibe, tasteState.seen, tasteState.skipped]
  );

  if (!movie?.id) {
    return null;
  }

  const handleAction = (actionKey, handler) => {
    handler();
    setFeedback(feedbackMap[actionKey] || "Saved");
  };

  return (
    <div className={classes}>
      <button
        type="button"
        className={`taste-action-button${tasteState.inWatchlist ? " is-active" : ""}`}
        onClick={() => handleAction("watchlist", () => actions.toggleWatchlist(movie))}
      >
        {tasteState.inWatchlist ? "In Watchlist" : "Save to Watchlist"}
      </button>
      <button
        type="button"
        className={`taste-action-button${tasteState.seen ? " is-active" : ""}`}
        onClick={() => handleAction("seen", () => actions.toggleSeen(movie))}
      >
        {tasteState.seen ? "Seen" : "Mark Seen"}
      </button>
      <button
        type="button"
        className={`taste-action-button${tasteState.skipped ? " is-active" : ""}`}
        onClick={() => handleAction("hidden", () => actions.toggleSkipped(movie))}
      >
        {tasteState.skipped ? "Hidden" : "Not for Me"}
      </button>
      {vibeLabel ? (
        <button
          type="button"
          className={`taste-action-button${tasteState.likedVibe ? " is-active" : ""}`}
          onClick={() => handleAction("vibe", () => actions.toggleLikedVibe(movie, vibeLabel))}
        >
          {tasteState.likedVibe ? "Vibe Saved" : "Like this Vibe"}
        </button>
      ) : null}
      {feedback ? <span className="taste-action-feedback">{feedback}</span> : null}
    </div>
  );
}

export default TasteActionBar;
