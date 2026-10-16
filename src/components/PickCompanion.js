import React, { useEffect, useId, useRef } from 'react';
import TasteActionBar from './TasteActionBar';

export default function PickCompanion({ movie, onRefine, refineActions = [], disabled = false, recovery = null }) {
  const descriptionId = useId();
  const refinementsRef = useRef(null);
  useEffect(() => { if (recovery && refinementsRef.current) refinementsRef.current.open = true; }, [recovery]);
  return <section className="pick-companion picker-adjustments" aria-label="Adjust your pick or leave feedback">
    {onRefine && refineActions.length ? <details ref={refinementsRef} className="picker-refinements" key={`refine-${movie.id}`}>
      <summary>Adjust this pick<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
      {recovery}
      <p className="picker-refinements-intro">Keep your request, change the direction.</p>
      <div className="pick-companion-actions">{refineActions.map(action => <button className="pick-adjust-chip" type="button" key={action.id} aria-label={action.label} aria-describedby={['different_angle', 'more_like_this'].includes(action.id) ? `${descriptionId}-${action.id}` : undefined} disabled={disabled} onClick={() => onRefine(action)}>
        <span>{action.label}</span>
        {action.id === 'different_angle' ? <small id={`${descriptionId}-${action.id}`}>A different approach to your request</small> : action.id === 'more_like_this' ? <small id={`${descriptionId}-${action.id}`}>Closer to {movie.title}</small> : null}
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
