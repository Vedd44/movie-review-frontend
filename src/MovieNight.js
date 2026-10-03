import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { API_BASE_URL, getMoviePath } from './discovery';
import { buildAbsoluteUrl } from './siteConfig';
import { usePageMetadata } from './seo';
import { movieNightPath, parseMovieNight, shareMovieNight } from './movieNightUtils';
import { trackProductEvent } from './analytics';

export default function MovieNight() {
  const { search } = useLocation();
  const { ids, choice: sharedChoice } = useMemo(() => parseMovieNight(search), [search]);
  const [movies, setMovies] = useState([]);
  const [choice, setChoice] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  usePageMetadata({ title: 'Choose a Movie Together | ReelBot', description: 'Choose from a few ReelBot picks and share your choice.', path: '/movie-night', robots: 'noindex,follow' });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setMovies([]); setChoice(null); setStatus('');
    // Only visiting a shared shortlist loads details. Picking/sharing never generates more recommendations.
    Promise.all(ids.map(async id => {
      try {
        const response = await fetch(`${API_BASE_URL}/movies/${id}`, { signal: controller.signal });
        if (!response.ok) return null;
        const movie = await response.json();
        return Number(movie.id) === id ? movie : null;
      } catch { return null; }
    })).then(items => {
      if (controller.signal.aborted) return;
      const available = items.filter(Boolean);
      setMovies(available); setLoading(false);
      if (!available.some(movie => Number(movie.id) === sharedChoice)) setChoice(null);
    });
    return () => controller.abort();
  }, [ids, sharedChoice]);
  const share = async () => {
    if (sharing) return;
    setSharing(true);
    const selected = movies.find(movie => Number(movie.id) === choice);
    try {
      setStatus(await shareMovieNight(buildAbsoluteUrl(movieNightPath(movies, choice)), selected ? `My vote is ${selected.title}. What do you think?` : 'What should we watch? Pick your favourite and send your choice back.'));
      trackProductEvent('shortlist_choice_shared', { movie_id: choice || 0 });
    } catch (error) { if (error.name !== 'AbortError') setStatus('Sharing didn’t work. You can copy the link below.'); }
    finally { setSharing(false); }
  };
  return <div className="browse-page"><div className="container browse-shell">
    <h1>Your movie night</h1><p>A few good options. Which one feels right?</p>
    <p className="detail-secondary-text">Choose your favourite and send your vote back. Choices travel with the link; there’s no live vote count.</p>
    {loading ? <p role="status">Loading your shortlist…</p> : !movies.length ? <p>This shortlist couldn’t be loaded. <Link to="/">Find a movie</Link> to start a new one.</p> : <>
      {sharedChoice && movies.some(movie => Number(movie.id) === sharedChoice) ? <p>Shared vote: <strong>{movies.find(movie => Number(movie.id) === sharedChoice).title}</strong>. What would you choose?</p> : null}
      <div className="movie-night-grid">{movies.map(movie => <article className="detail-info-card" key={movie.id}>
        <h2><Link to={getMoviePath(movie)}>{movie.title}</Link></h2>
        <p>{movie.release_date?.slice(0, 4)}{movie.runtime ? ` · ${movie.runtime} min` : ''}</p>
        <p>{movie.description || movie.overview}</p>
        <button className="reelbot-inline-button" type="button" aria-pressed={choice === Number(movie.id)} onClick={() => { setChoice(Number(movie.id)); setStatus(''); trackProductEvent('shortlist_choice', { movie_id: Number(movie.id) }); }}>{choice === Number(movie.id) ? 'My choice' : 'I’d watch this'}</button>
      </article>)}</div>
      <button className="reelbot-inline-button reelbot-inline-button--solid" type="button" disabled={sharing} onClick={share}>{choice ? 'Send my vote' : 'Share these picks'}</button>
      {status ? <div role="status"><p>{status}</p><a href={buildAbsoluteUrl(movieNightPath(movies, choice))}>Your movie-night link</a></div> : null}
    </>}
  </div></div>;
}
