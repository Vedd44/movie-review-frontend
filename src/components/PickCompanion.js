import React, { useEffect, useId, useRef } from 'react';
import TasteActionBar from './TasteActionBar';

export default function PickCompanion({ movie, onRefine, refineActions = [], disabled = false, recovery = null }) {
  const descriptionId = useId();
  const refinementsRef = useRef(null);
  useEffect(() => { if (recovery && refinementsRef.current) refinementsRef.current.open = true; }, [recovery]);
  const descriptions = {
    different_angle: 'A different approach to your request',
    more_like_this: `Closer to ${movie.title}`,
    lighter: 'A lighter mood',
    darker: 'A darker mood',
    shorter: 'A shorter running time',
    funnier: 'More laughs',
    less_intense: 'Ease up on intensity',
  };
  return <section className="pick-companion picker-adjustments" aria-label="Adjust your pick or leave feedback">
    {onRefine && refineActions.length ? <details ref={refinementsRef} className="picker-refinements" key={`refine-${movie.id}`}>
      <summary><span className="picker-refinements-heading"><span>Adjust this pick</span><span className="picker-refinements-intro">Keep your request, change the direction.</span></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
      {recovery}
      <div className="pick-companion-actions" style={{ "--refine-action-count": refineActions.length }}>{refineActions.map(action => <button className="pick-adjust-chip" type="button" key={action.id} aria-label={action.label} aria-describedby={descriptions[action.id] ? `${descriptionId}-${action.id}` : undefined} disabled={disabled} onClick={() => onRefine(action)}>
        <span>{action.label}</span>
        {descriptions[action.id] ? <small id={`${descriptionId}-${action.id}`}>{descriptions[action.id]}</small> : null}
      </button>)}</div>
    </details> : null}
    <div className="pick-feedback-row">
      <details className="picker-feedback" key={movie.id}>
        <summary>Watched or not for you?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
        <div className="picker-feedback-content">
          <TasteActionBar movie={movie} compact disabled={disabled} showFeedbackIcons showFeedbackConfirmation showSaveAction={false} showVibeAction={false} seenLabel="Watched" />
        </div>
      </details>
    </div>
  </section>;
}
