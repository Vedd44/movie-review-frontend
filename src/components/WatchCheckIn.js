import React, { useEffect, useState } from 'react';
import useTasteProfile from '../hooks/useTasteProfile';
import { useAuth } from '../context/AuthContext';
import { trackProductEvent } from '../analytics';

const DAY = 86400000;
const CHECK_IN_INTERVAL = 7 * DAY;

export function findWatchCheckIn(profile, dismissed = [], now = Date.now(), snoozed = {}) {
  // recentRecommendations contains queued alternatives too, in reverse order.
  // Pick history explicitly records the displayed primary first. Only ask about
  // the newest event, never work backwards through an unseen backlog.
  const history = Array.isArray(profile.pickHistory) ? profile.pickHistory : [];
  if (history.some(entry => !entry || !Number.isFinite(Date.parse(entry.saved_at)))) return undefined;
  const latest = history.reduce((result, entry) =>
    !result || Date.parse(entry.saved_at) > Date.parse(result.saved_at) ? entry : result, null);
  if (!Array.isArray(latest?.movie_ids)) return undefined;
  const id = Number(latest.movie_ids[0]);
  const age = now - Date.parse(latest?.saved_at);
  if (!Number.isSafeInteger(id) || id <= 0 || !(age >= DAY && age <= 30 * DAY)) return undefined;
  const movie = (profile.recentRecommendations || []).find(item => Number(item?.id) === id);
  if (!movie || typeof movie.title !== 'string' || !movie.title.trim() || movie.title === 'Unknown title' ||
      dismissed.includes(id) || Number(snoozed[id]) > now ||
      (profile.seen || []).some(item => Number(item.id) === id) ||
      (profile.skipped || []).some(item => Number(item.id) === id)) return undefined;
  return movie;
}

const readCheckInState = key => {
  try {
    const dismissed = JSON.parse(localStorage.getItem(key) || '[]');
    const snoozed = JSON.parse(localStorage.getItem(`${key}:snoozed`) || '{}');
    const shownAt = Number(localStorage.getItem(`${key}:shown-at`) || 0);
    return {
      dismissed: Array.isArray(dismissed) ? dismissed.map(Number) : [],
      snoozed: snoozed && typeof snoozed === 'object' && !Array.isArray(snoozed) ? snoozed : {},
      shownAt: Number.isFinite(shownAt) ? shownAt : Date.now(),
    };
  } catch {
    // This is optional: if its frequency controls cannot be read, stay quiet.
    return null;
  }
};

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
      <p role="status"><strong>{movie.title}</strong>{choice === 'seen' ? ' is now in Watched. We’ll prioritize movies you haven’t seen.' : ' is now in Not for me. We’ll leave this out of future picks. You can change this in My Movies.'}</p>
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

function OwnerWatchCheckIn({ ownerKey, profile, actions, getMovieState, user }) {
  const [state] = useState(() => readCheckInState(ownerKey));
  const [quiet, setQuiet] = useState(false);
  const [answerStarted, setAnswerStarted] = useState(false);
  const [movie] = useState(() => {
    const now = Date.now();
    if (!state || (state.shownAt && now - state.shownAt < CHECK_IN_INTERVAL)) return null;
    return findWatchCheckIn(profile, state.dismissed, now, state.snoozed) || null;
  });
  useEffect(() => {
    if (!movie) return;
    try { localStorage.setItem(`${ownerKey}:shown-at`, String(Date.now())); }
    catch { setQuiet(true); }
  }, [movie, ownerKey]);
  const currentMovie = state && findWatchCheckIn(profile, state.dismissed, Date.now(), state.snoozed);
  if (!movie || quiet || (!answerStarted && Number(currentMovie?.id) !== Number(movie.id))) return null;
  const hide = () => {
    const next = [...state.dismissed, Number(movie.id)].slice(-30);
    try { localStorage.setItem(ownerKey, JSON.stringify(next)); } catch {}
    setQuiet(true);
  };
  const pause = () => {
    const now = Date.now();
    const next = Object.fromEntries(Object.entries(state.snoozed).filter(([, until]) => Number(until) > now));
    next[movie.id] = now + CHECK_IN_INTERVAL;
    try { localStorage.setItem(`${ownerKey}:snoozed`, JSON.stringify(next)); } catch {}
    setQuiet(true);
  };
  return <WatchCheckInPrompt movie={movie} actions={actions} getMovieState={getMovieState} user={user} onBegin={() => setAnswerStarted(true)} onPause={pause} onHide={hide} />;
}

export default function WatchCheckIn() {
  const { profile, actions, getMovieState, isProfileReady } = useTasteProfile();
  const { user, authReady } = useAuth();
  if (!authReady || !isProfileReady) return null;
  const ownerKey = `reelbot:watch-check-in:${user?.id || 'guest'}`;
  return <OwnerWatchCheckIn key={ownerKey} ownerKey={ownerKey} profile={profile} actions={actions} getMovieState={getMovieState} user={user} />;
}
