import React from 'react';
import TasteActionBar from './TasteActionBar';

export default function PickCompanion({ movie, onRefine, refineActions = [], disabled = false }) {
  return <section className="pick-companion picker-adjustments" aria-label="Adjust your pick or leave feedback">
    {onRefine && refineActions.length ? <div className="pick-adjust-row">
      <span className="pick-adjust-label">Adjust your pick</span>
      <div className="pick-companion-actions">{refineActions.slice(0, 3).map(action => <button className="pick-adjust-chip" type="button" key={action.id} disabled={disabled} onClick={() => onRefine(action)}>{action.label}</button>)}{refineActions.length > 3 ? <details className="pick-refine-more"><summary><span>More adjustments</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary><div>{refineActions.slice(3).map(action => <button className="pick-adjust-chip" type="button" key={action.id} disabled={disabled} onClick={() => onRefine(action)}>{action.label}</button>)}</div></details> : null}</div>
    </div> : null}
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
