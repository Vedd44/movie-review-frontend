import React, { useState } from 'react';
import useTasteProfile from '../hooks/useTasteProfile';
import { useAuth } from '../context/AuthContext';
import TasteActionBar from './TasteActionBar';

export function findWatchCheckIn(profile, dismissed = [], now = Date.now()) {
  return (profile.recentRecommendations || []).find(movie => {
    const age = now - Date.parse(movie.recommended_at);
    return age >= 86400000 && age <= 30 * 86400000 && movie.title &&
      !dismissed.includes(Number(movie.id)) &&
      !(profile.seen || []).some(item => Number(item.id) === Number(movie.id)) &&
      !(profile.skipped || []).some(item => Number(item.id) === Number(movie.id));
  });
}
export default function WatchCheckIn() {
  const { profile } = useTasteProfile();
  const { user } = useAuth();
  const key = `reelbot:watch-check-in:${user?.id || 'guest'}`;
  const [dismissedByOwner, setDismissedByOwner] = useState({});
  let stored = [];
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(value)) stored = value.map(Number); } catch {}
  const dismissed = dismissedByOwner[key] || stored;
  const movie = findWatchCheckIn(profile, dismissed);
  if (!movie) return null;
  const dismiss = () => {
    const next = [...dismissed, Number(movie.id)].slice(-30);
    setDismissedByOwner(previous => ({ ...previous, [key]: next }));
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  };
  return (
    <details className="watch-check-in" key={movie.id}>
      <summary>
        <span>Did you watch <strong>{movie.title}</strong>?</span>
        <svg className="watch-check-in-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="watch-check-in-body">
        <p>A quick update helps shape your next pick.</p>
        <div className="watch-check-in-actions">
          <TasteActionBar movie={movie} compact showSaveAction={false} showVibeAction vibeLabel={movie.source_prompt || movie.title} seenLabel="Watched" />
          <button className="watch-check-in-dismiss" type="button" onClick={dismiss}>Not yet</button>
        </div>
      </div>
    </details>
  );
}
