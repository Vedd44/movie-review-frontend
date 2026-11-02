import React, { createContext, useContext, useState, useEffect, useRef } from "react";
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
    overview: typeof movie.overview === "string" ? movie.overview.trim() : "",
  };
}

export default function PickContender({ current, held, disabled, onKeep, onRemove, onReturn }) {
  const rootRef = useRef(null);
  const restoreFocus = () => window.requestAnimationFrame(() => rootRef.current?.querySelector("button:not(:disabled)")?.focus({ preventScroll: true }));
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState(null);
  const currentMovie = current?.primary;
  const heldMovie = held?.primary;
  useEffect(() => {
    if (!heldMovie) setExpanded(false);
  }, [heldMovie]);
  if (!currentMovie) return null;
  const noticeKey = `${currentMovie.id}:${heldMovie?.id || ""}`;
  const announce = (text, currentId, heldId) => setNotice({ text, key: `${currentId}:${heldId || ""}` });
  const sameMovie = String(currentMovie.id) === String(heldMovie?.id);
  const canCompare = Boolean(heldMovie && !sameMovie);
  const left = comparisonFacts(heldMovie);
  const right = comparisonFacts(currentMovie);
  const difference = left.runtime && right.runtime ? Math.abs(left.runtime - right.runtime) : null;
  const shorter = left.runtime < right.runtime ? heldMovie : currentMovie;
  return (
    <section ref={rootRef} className="pick-contender" aria-label="Keep a contender">
      <div className="pick-contender-bar">
        <div>
          {heldMovie ? <><span className="pick-contender-label">Kept as an option</span><strong>{heldMovie.title}</strong></> : <><strong>Like this one, but still looking?</strong><span>Keep it here while you try another pick.</span></>}
        </div>
        <div className="pick-contender-controls">
          {!heldMovie ? <button type="button" disabled={disabled} onClick={() => { onKeep(); announce(`${currentMovie.title} kept. You can get another pick without losing it.`, currentMovie.id, currentMovie.id); restoreFocus(); }}>Keep this option</button> : <>
            {canCompare ? <button type="button" disabled={disabled} aria-expanded={expanded} aria-controls="pick-contender-comparison" onClick={() => setExpanded(value => !value)}>{expanded ? "Close comparison" : "Compare the two"}</button> : <span className="pick-contender-next">Try “Get another pick” below.</span>}
            <button type="button" disabled={disabled} className="pick-contender-remove" aria-label={`Remove ${heldMovie.title} as an option`} onClick={() => { onRemove(); setExpanded(false); announce("Option removed. Your current pick is unchanged.", currentMovie.id, null); restoreFocus(); }}>Remove</button>
          </>}
        </div>
      </div>
      <p className="pick-contender-notice" role="status">{notice?.key === noticeKey ? notice.text : ""}</p>
      {canCompare && expanded ? <div id="pick-contender-comparison" className="pick-contender-comparison">
        <h3>Which would you rather watch?</h3>
        {difference !== null ? <p className="pick-contender-difference">{difference === 0 ? "Both have the same runtime." : `${shorter.title} is ${difference} minutes shorter.`}</p> : null}
        <div className="pick-contender-grid">
          {[{ movie: heldMovie, facts: left, isHeld: true }, { movie: currentMovie, facts: right, isHeld: false }].map(({ movie, facts, isHeld }) => <article key={movie.id} className="pick-contender-film">
            <span className="pick-contender-label">{isHeld ? "Your kept option" : "Your current pick"}</span>
            <h4>{movie.title}</h4>
            <dl><div><dt>Year</dt><dd>{facts.year || "Not available"}</dd></div><div><dt>Runtime</dt><dd>{facts.runtime ? `${facts.runtime} min` : "Not available"}</dd></div></dl>
            <p>{facts.overview || "A plot summary isn’t available for this pick. Open the film details for more information."}</p>
            <button type="button" disabled={disabled} onClick={() => { if (isHeld) onReturn(); setExpanded(false); announce(`${movie.title} is your current pick. The other option is still here.`, movie.id, isHeld ? currentMovie.id : heldMovie.id); restoreFocus(); }}>{isHeld ? `Return to ${movie.title}` : `Stay with ${movie.title}`}</button>
          </article>)}
        </div>
        <p className="pick-contender-caption">Keeping an option doesn’t save it to My Movies or mark it watched.</p>
      </div> : null}
    </section>
  );
}
