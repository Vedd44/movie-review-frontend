import React, { useState } from 'react';
import TasteActionBar from './TasteActionBar';
import { buildAbsoluteUrl } from '../siteConfig';
import { movieNightPath, shareMovieNight } from '../movieNightUtils';
import { trackProductEvent } from '../analytics';

const REASONS = [
  { id: 'shorter', label: 'Too long', loadingMessage: 'Finding something shorter…' },
  { id: 'less_intense', label: 'Too intense', loadingMessage: 'Finding something easier to settle into…' },
  { id: 'different_angle', label: 'Not my mood', loadingMessage: 'Trying a different angle…' },
];
export default function PickCompanion({ movie, alternatives = [], onRefine, disabled = false }) {
  const [shareStatus, setShareStatus] = useState('');
  const [sharing, setSharing] = useState(false);
  const url = buildAbsoluteUrl(movieNightPath([movie, ...alternatives]));
  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      setShareStatus(await shareMovieNight(url, 'What should we watch? Here are our ReelBot picks.'));
      trackProductEvent('shortlist_shared', { movie_count: Math.min(3, 1 + alternatives.length) });
    } catch (error) {
      if (error.name !== 'AbortError') setShareStatus('Sharing didn’t work. You can copy the link below.');
    } finally { setSharing(false); }
  };
  return <section className="pick-companion" aria-label="Personalise and share your pick">
    <details>
      <summary>Make this more you</summary>
      <p>Seen it already? Not your thing? Tell ReelBot so future picks fit better.</p>
      <TasteActionBar movie={movie} compact showSaveAction={false} showVibeAction={false} seenLabel="Watched" />
      {onRefine ? <><p>What would fit better tonight?</p><div className="pick-companion-actions">{REASONS.map(reason => <button className="reelbot-inline-button" type="button" key={reason.id} disabled={disabled} onClick={() => { trackProductEvent('pick_feedback_reason', { reason: reason.id }); onRefine(reason); }}>{reason.label}</button>)}</div><p className="detail-secondary-text">Your original request still guides the next pick.</p></> : null}
    </details>
    <button className="reelbot-inline-button" type="button" onClick={share} disabled={sharing}>Share movie-night picks</button>
    {shareStatus ? <div role="status"><p>{shareStatus}</p><a href={url}>Your movie-night link</a></div> : null}
  </section>;
}
