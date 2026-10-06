import React, { useState } from 'react';
import useTasteProfile from '../hooks/useTasteProfile';
import { useAuth } from '../context/AuthContext';
import { trackProductEvent } from '../analytics';

export function findWatchCheckIn(profile, dismissed = [], now = Date.now(), snoozed = {}) {
  return (profile.recentRecommendations || []).find(movie => {
    const age = now - Date.parse(movie.recommended_at);
    return age >= 86400000 && age <= 30 * 86400000 && movie.title &&
      !dismissed.includes(Number(movie.id)) &&
      !(Number(snoozed[movie.id]) > now) &&
      !(profile.seen || []).some(item => Number(item.id) === Number(movie.id)) &&
      !(profile.skipped || []).some(item => Number(item.id) === Number(movie.id));
  });
}

function WatchCheckInPrompt({ movie, actions, getMovieState, user, onBegin, onPause, onHide }) {
  const [status, setStatus] = useState('idle');
  const [choice, setChoice] = useState(null);
  const save = async (answer) => {
    if (status === 'saving') return;
    onBegin();
    setChoice(answer);
    setStatus('saving');
    try {
      const state = getMovieState(movie.id);
      if (answer === 'seen' && !state.seen) await actions.toggleSeen(movie, { historyOnly: true });
      if (answer === 'hidden' && !state.skipped) await actions.toggleSkipped(movie, { titleOnly: true });
      trackProductEvent(answer === 'seen' ? 'movie_watched' : 'movie_hidden', { authenticated: Boolean(user), movie_id: Number(movie.id) });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };
  if (status === 'saved') return (
    <section className="watch-check-in watch-check-in--saved" aria-label="Movie update saved">
      <p role="status"><strong>{movie.title}</strong>{choice === 'seen' ? ' is now in Watched. We’ll prioritize movies you haven’t seen.' : ' is now in Not for me. We won’t recommend this movie.'}</p>
      <button className="watch-check-in-dismiss" type="button" onClick={onHide}>Done</button>
    </section>
  );
  return (
    <section className="watch-check-in" aria-label="Your last pick">
      <div className="watch-check-in-header">
        <p>Your last pick: <strong>{movie.title}</strong></p>
        <button className="watch-check-in-dismiss watch-check-in-close" type="button" aria-label="Dismiss last pick" disabled={status === 'saving'} onClick={onHide}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div className="watch-check-in-actions">
        <button className="watch-check-in-answer" type="button" disabled={status === 'saving'} onClick={() => save('seen')}>{status === 'saving' && choice === 'seen' ? 'Saving…' : 'Seen it'}</button>
        <button className="watch-check-in-answer" type="button" disabled={status === 'saving'} onClick={() => save('hidden')}>{status === 'saving' && choice === 'hidden' ? 'Saving…' : 'Not interested'}</button>
        <button className="watch-check-in-answer" type="button" disabled={status === 'saving'} onClick={onPause}>Maybe later</button>
      </div>
      {status === 'error' ? <p className="watch-check-in-error" role="alert">Couldn’t save your update. Please try again.</p> : null}
    </section>
  );
}

export default function WatchCheckIn() {
  const { profile, actions, getMovieState } = useTasteProfile();
  const { user } = useAuth();
  const key = `reelbot:watch-check-in:${user?.id || 'guest'}`;
  const snoozeKey = `${key}:snoozed`;
  const [dismissedByOwner, setDismissedByOwner] = useState({});
  const [quietOwners, setQuietOwners] = useState({});
  const [selection, setSelection] = useState(null);
  let stored = [], snoozed = {};
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(value)) stored = value.map(Number); } catch {}
  try { const value = JSON.parse(localStorage.getItem(snoozeKey) || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) snoozed = value; } catch {}
  const dismissed = dismissedByOwner[key] || stored;
  const movie = selection?.owner === key ? selection.movie : findWatchCheckIn(profile, dismissed, Date.now(), snoozed);
  if (!movie || quietOwners[key]) return null;
  const quiet = () => setQuietOwners(previous => ({ ...previous, [key]: true }));
  const hide = () => {
    const next = [...dismissed, Number(movie.id)].slice(-30);
    setDismissedByOwner(previous => ({ ...previous, [key]: next }));
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
    quiet();
  };
  const pause = () => {
    const now = Date.now();
    const next = Object.fromEntries(Object.entries(snoozed).filter(([, until]) => Number(until) > now));
    next[movie.id] = now + 7 * 86400000;
    try { localStorage.setItem(snoozeKey, JSON.stringify(next)); } catch {}
    quiet();
  };
  return <WatchCheckInPrompt key={`${key}:${movie.id}`} movie={movie} actions={actions} getMovieState={getMovieState} user={user} onBegin={() => setSelection({ owner: key, movie })} onPause={pause} onHide={hide} />;
}
