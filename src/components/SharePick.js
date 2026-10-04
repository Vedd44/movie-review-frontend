import React, { useEffect, useRef, useState } from 'react';
import { getMoviePath } from '../discovery';
import { buildAbsoluteUrl } from '../siteConfig';
import { sharedPickQuery } from '../sharedPick';
import { trackProductEvent } from '../analytics';

export default function SharePick({ movie, why = '', prompt = '', disabled = false }) {
  const dialog = useRef(null);
  const [includeRequest, setIncludeRequest] = useState(false);
  const [status, setStatus] = useState('');
  const [sharing, setSharing] = useState(false);
  const [sharedUrl, setSharedUrl] = useState('');
  useEffect(() => { dialog.current?.close?.(); setIncludeRequest(false); setStatus(''); setSharedUrl(''); }, [movie.id]);
  const share = async (copyOnly = false) => {
    if (sharing || disabled) return;
    const url = buildAbsoluteUrl(`${getMoviePath(movie)}?${sharedPickQuery(movie, why, includeRequest ? prompt : '')}`);
    const title = `Tonight’s pick: ${movie.title}`;
    setSharing(true); setStatus(''); setSharedUrl(url);
    try {
      if (!copyOnly && navigator.share) { await navigator.share({ title, text: `ReelBot picked ${movie.title} for me. What do you think?`, url }); setStatus('Shared'); }
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); setStatus('Link copied'); }
      else setStatus('Copy the link below.');
      trackProductEvent('pick_shared', { movie_id: Number(movie.id), includes_request: includeRequest });
    } catch (error) { if (error.name !== 'AbortError') setStatus('Couldn’t share. Try Copy link, or open the link below.'); }
    finally { setSharing(false); }
  };
  return <>
    <button className="pick-share-trigger" type="button" disabled={disabled} onClick={() => dialog.current.showModal()}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 11v9h14v-9" /></svg>Share this pick</button>
    <dialog ref={dialog} className="pick-share-dialog" aria-labelledby="share-pick-title" onClose={() => setStatus('')}>
      <button className="pick-share-close" type="button" aria-label="Close sharing" onClick={() => dialog.current.close()}>×</button>
      <p className="pick-share-eyebrow">PICKED BY REELBOT</p><h2 id="share-pick-title">Share this pick</h2>
      <div className="pick-share-preview">{movie.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} alt="" /> : null}<div><strong>{movie.title}</strong><p>A movie for tonight. Send it to someone you’d watch with.</p></div></div>
      {prompt.trim() ? <label className="pick-share-option"><input type="checkbox" checked={includeRequest} onChange={event => { setIncludeRequest(event.target.checked); setStatus(''); setSharedUrl(''); }} />Include my request</label> : null}
      {includeRequest ? <blockquote>{prompt}</blockquote> : null}
      <p className="pick-share-note">Anyone with the link can see this pick and why it fits{includeRequest ? ', including your request' : ''}.</p>
      <div className="pick-share-dialog-actions"><button className="reelbot-inline-button reelbot-inline-button--solid" type="button" disabled={sharing} onClick={() => share()}>Share pick</button><button className="reelbot-inline-button" type="button" disabled={sharing} onClick={() => share(true)}>Copy link</button></div>
      {status ? <p role="status">{status} {sharedUrl ? <a href={sharedUrl}>Open shared pick</a> : null}</p> : null}
    </dialog>
  </>;
}
