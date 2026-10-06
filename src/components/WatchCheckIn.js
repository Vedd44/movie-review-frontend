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
  const watched = async () => {
    if (status === 'saving') return;
    onBegin();
    setStatus('saving');
    try {
      if (!getMovieState(movie.id).seen) await actions.toggleSeen(movie, { watchedAt: new Date().toISOString() });
      trackProductEvent('movie_watched', { authenticated: Boolean(user), movie_id: Number(movie.id) });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };
  if (status === 'saved') return (
    <section className="watch-check-in watch-check-in--saved" aria-label="Watch status saved">
      <p role="status"><strong>{movie.title}</strong> is now in Watched. We’ll prioritize movies you haven’t seen.</p>
      <button className="watch-check-in-dismiss" type="button" onClick={onHide}>Done</button>
    </section>
  );
  return (
    <details className="watch-check-in">
      <summary>
        <span>Did you watch <strong>{movie.title}</strong>?</span>
        <svg className="watch-check-in-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="watch-check-in-body">
        <p>Recently watched it? We’ll give it a break for three months and prioritize movies you haven’t seen. You can still ask for a rewatch.</p>
        <div className="watch-check-in-actions">
          <button className="watch-check-in-answer" type="button" disabled={status === 'saving'} onClick={watched}>{status === 'saving' ? 'Saving…' : 'Yes, I just watched it'}</button>
          <button className="watch-check-in-answer" type="button" disabled={status === 'saving'} onClick={onPause}>Not yet</button>
          <button className="watch-check-in-dismiss" type="button" disabled={status === 'saving'} onClick={onHide}>Hide question</button>
        </div>
        <p className="watch-check-in-note">“Not yet” pauses this reminder for a week. Hide it anytime without updating your preferences.</p>
        {status === 'error' ? <p className="watch-check-in-error" role="alert">Couldn’t save your watch status. Please try again.</p> : null}
      </div>
    </details>
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
