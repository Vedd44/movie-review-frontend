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
  return <details className="watch-check-in"><summary>Did you watch {movie.title}?</summary>
    <p>A quick update helps shape your next pick.</p>
    <TasteActionBar movie={movie} compact showSaveAction={false} showVibeAction vibeLabel={movie.source_prompt || movie.title} seenLabel="Watched" />
    <button className="reelbot-inline-button" type="button" onClick={dismiss}>Not yet</button>
  </details>;
}
