import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import ArtworkFallback from "./ArtworkFallback";
import MovieCopy from "./MovieCopy";
import "./PickContender.css";

// Deliberately memory-only: no watchlist, taste signal, analytics or API calls.
const ContenderContext = createContext(null);
export function HomeContenderProvider({ children, identity = "guest" }) {
  const state = useState(null);
  const setHeld = state[1];
  useEffect(() => { setHeld(null); }, [identity, setHeld]);
  return <ContenderContext.Provider value={state}>{children}</ContenderContext.Provider>;
}
export function useHomeContender() {
  const context = useContext(ContenderContext);
  const localState = useState(null);
  return context || localState;
}

export function comparisonFacts(movie = {}) {
  const runtime = Number(movie.runtime);
  return {
    runtime: Number.isFinite(runtime) && runtime > 0 ? runtime : null,
    year: /^\d{4}-\d{2}-\d{2}$/.test(movie.release_date || "") ? movie.release_date.slice(0, 4) : null,
  };
}

// Reuse the explanation already attached to this exact pick. Do not infer mood
// from genre tags, substitute a plot synopsis, or ask the model to compare again.
export function comparisonReason(pick) {
  const reasons = [pick?.rationale?.primary_reason, pick?.primary?.reason, pick?.rationale?.decisionSentence];
  const reason = reasons.find(value => typeof value === "string" && value.trim());
  return reason ? reason.replace(/\s+/g, " ").trim() : "";
}

export default function PickContender({ current, held, disabled, onReturn }) {
  const rootRef = useRef(null);
  const [expandedPair, setExpandedPair] = useState(null);
  const [notice, setNotice] = useState(null);
  const currentMovie = current?.primary;
  const previousMovie = held?.primary;
  const pairKey = `${currentMovie?.id || ""}:${previousMovie?.id || ""}`;
  const expanded = expandedPair === pairKey;
  useEffect(() => { setExpandedPair(null); }, [pairKey]);
  const restoreFocus = () => window.requestAnimationFrame(() => rootRef.current?.querySelector(".pick-contender-toggle:not(:disabled)")?.focus({ preventScroll: true }));
  const returnToPrevious = () => {
    onReturn();
    setExpandedPair(null);
    setNotice({ key: `${previousMovie.id}:${currentMovie.id}`, text: `Returned to ${previousMovie.title}.` });
    restoreFocus();
  };
  if (!currentMovie || !previousMovie || String(currentMovie.id) === String(previousMovie.id)) return null;

  return (
    <section ref={rootRef} className="pick-contender" aria-label="Previous pick">
      <div className="pick-contender-bar">
        <div className="pick-contender-previous">
          <span>Previous pick:</span>
          {expanded ? <span className="pick-contender-previous-title">{previousMovie.title}</span> : <button type="button" disabled={disabled} className="pick-contender-return" aria-label={`Return to ${previousMovie.title}`} title={`Return to ${previousMovie.title}`} onClick={returnToPrevious}>{previousMovie.title}<span aria-hidden="true"> ↶</span></button>}
        </div>
        <button type="button" disabled={disabled} className="pick-contender-toggle" aria-expanded={expanded} aria-controls="pick-contender-comparison" onClick={() => setExpandedPair(expanded ? null : pairKey)}>{expanded ? "Close comparison" : "Compare picks"}</button>
      </div>
      <span className="sr-only" role="status">{notice?.key === pairKey ? notice.text : ""}</span>
      {expanded ? <div id="pick-contender-comparison" className="pick-contender-comparison">
        <h3>Which feels right tonight?</h3>
        <div className="pick-contender-grid">
          {[{ pick: held, isPrevious: true }, { pick: current, isPrevious: false }].map(({ pick, isPrevious }) => {
            const movie = pick.primary;
            const facts = comparisonFacts(movie);
            const reason = comparisonReason(pick);
            return <article key={movie.id} className="pick-contender-film">
              <div className="pick-contender-film-heading">
                {movie.poster_path ? <img className="pick-contender-poster" src={`https://image.tmdb.org/t/p/w154${movie.poster_path}`} alt="" width="54" height="81" /> : <ArtworkFallback className="pick-contender-poster" />}
                <div><span className="pick-contender-label">{isPrevious ? "Previous pick" : "Current pick"}</span><h4>{movie.title}</h4><p className="pick-contender-meta">{facts.year || "Year unavailable"}<span aria-hidden="true"> · </span>{facts.runtime ? `${facts.runtime} min` : "Runtime unavailable"}</p></div>
              </div>
              <p className="pick-contender-reason">{reason ? <MovieCopy titles={[movie.title]}>{reason}</MovieCopy> : "A recommendation reason isn’t available for this pick."}</p>
              <button type="button" className="pick-contender-choice" disabled={disabled} onClick={isPrevious ? returnToPrevious : () => { setExpandedPair(null); setNotice({ key: pairKey, text: `Staying with ${movie.title}.` }); restoreFocus(); }}>{isPrevious ? `Return to ${movie.title}` : `Stay with ${movie.title}`}</button>
            </article>;
          })}
        </div>
        <p className="pick-contender-caption">Just for this session. Neither choice saves a movie or changes your taste profile.</p>
      </div> : null}
    </section>
  );
}
