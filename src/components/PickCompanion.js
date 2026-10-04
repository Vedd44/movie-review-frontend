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
  return <section className="pick-companion" aria-label="Personalise and share your pick">
    {onRefine && refineActions.length ? <div className="pick-adjust-row">
      <span className="pick-adjust-label">Refine your pick</span>
      <div className="pick-companion-actions">{refineActions.slice(0, 3).map(action => <button className="pick-adjust-chip" type="button" key={action.id} disabled={disabled} onClick={() => onRefine(action)}>{action.label}</button>)}{refineActions.length > 3 ? <details className="pick-refine-more"><summary>More</summary><div>{refineActions.slice(3).map(action => <button className="pick-adjust-chip" type="button" key={action.id} disabled={disabled} onClick={() => onRefine(action)}>{action.label}</button>)}</div></details> : null}</div>
    </div> : null}
    <div className="pick-feedback-row">
      <TasteActionBar movie={movie} compact disabled={disabled} showSaveAction={false} showVibeAction={false} seenLabel="Watched" onInteraction={(key, state) => { if (key === 'hidden') setShowReasons(Boolean(state?.active)); }} />
    </div>
    {showReasons ? <div className="pick-feedback-reasons">
      <p>We’ll leave this movie out of future picks.</p>
      {onRefine ? <><span className="pick-adjust-label">What would work better tonight?</span><div className="pick-companion-actions">{REASONS.map(reason => <button className="pick-adjust-chip" type="button" key={reason.id} disabled={disabled} onClick={() => { trackProductEvent('pick_feedback_reason', { reason: reason.id }); onRefine(reason); }}>{reason.label}</button>)}</div></> : null}
    </div> : null}
  </section>;
}
