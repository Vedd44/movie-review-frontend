import React, { useEffect, useState } from 'react';
import TasteActionBar from './TasteActionBar';
import { trackProductEvent } from '../analytics';

const REASONS = [
  { id: 'shorter', label: 'Too long', loadingMessage: 'Finding something shorter…' },
  { id: 'less_intense', label: 'Too intense', loadingMessage: 'Finding something easier to settle into…' },
  { id: 'different_angle', label: 'Not my mood', loadingMessage: 'Trying a different angle…' },
];
export default function PickCompanion({ movie, onRefine, refineActions = [], disabled = false }) {
  const [showReasons, setShowReasons] = useState(false);
  useEffect(() => { setShowReasons(false); }, [movie.id]);
  return <section className="pick-companion picker-adjustments" aria-label="Adjust your pick or leave feedback">
    {onRefine && refineActions.length ? <div className="pick-adjust-row">
      <span className="pick-adjust-label">Adjust your pick</span>
      <div className="pick-companion-actions">{refineActions.slice(0, 3).map(action => <button className="pick-adjust-chip" type="button" key={action.id} disabled={disabled} onClick={() => onRefine(action)}>{action.label}</button>)}{refineActions.length > 3 ? <details className="pick-refine-more"><summary><span>More adjustments</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary><div>{refineActions.slice(3).map(action => <button className="pick-adjust-chip" type="button" key={action.id} disabled={disabled} onClick={() => onRefine(action)}>{action.label}</button>)}</div></details> : null}</div>
    </div> : null}
    <div className="pick-feedback-row">
      <details className="picker-feedback" key={movie.id}>
        <summary>Watched or not for you?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
        <div className="picker-feedback-content">
          <p>Keep future picks useful. You can undo either choice.</p>
          <TasteActionBar movie={movie} compact disabled={disabled} showFeedbackIcons showSaveAction={false} showVibeAction={false} seenLabel="Watched" onInteraction={(key, state) => { if (key === 'hidden') setShowReasons(Boolean(state?.active)); }} />
          {showReasons ? <div className="pick-feedback-reasons">
            <p>We’ll leave this movie out of future picks.</p>
            {onRefine ? <><span className="pick-adjust-label">For this pick, would you prefer…</span><div className="pick-companion-actions">{REASONS.map(reason => <button className="pick-adjust-chip" type="button" key={reason.id} disabled={disabled} onClick={() => { trackProductEvent('pick_feedback_reason', { reason: reason.id }); onRefine(reason); }}>{reason.label}</button>)}</div></> : null}
          </div> : null}
        </div>
      </details>
    </div>
  </section>;
}
