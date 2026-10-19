import { useEffect, useRef, useState } from 'react';
import { buildPublicShareUrl } from '../siteConfig';
import './DetailShare.css';

// Share public detail pages only, never location.search, prompts or taste history.
export default function DetailShare({ path, title, name }) {
  const url = buildPublicShareUrl(path);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [status, setStatus] = useState('');
  const pending = useRef(false);
  const operation = useRef(0);
  const mounted = useRef(true);
  const button = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const copy = async () => {
    if (pending.current) return;
    const current = ++operation.current;
    pending.current = true;
    setBusy(true);
    setStatus('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      if (mounted.current && current === operation.current) setStatus('Link copied');
    } catch {
      if (mounted.current && current === operation.current) {
        setFallback(true);
        setStatus('Select and copy the link below.');
      }
    } finally {
      if (current === operation.current) pending.current = false;
      if (mounted.current && current === operation.current) setBusy(false);
    }
  };

  const share = async () => {
    if (pending.current) return;
    if (typeof navigator.share !== 'function') return copy();
    const current = ++operation.current;
    pending.current = true;
    setBusy(true);
    setStatus('');
    setFallback(false);
    try {
      // Call synchronously from the click: native sharing needs user activation.
      await navigator.share({ title, url });
      // Resolution is not proof that the recipient received anything.
    } catch (error) {
      if (mounted.current && current === operation.current && error?.name !== 'AbortError') {
        setFallback(true);
        setStatus('Sharing is unavailable. Copy the link instead.');
      }
    } finally {
      if (current === operation.current) pending.current = false;
      if (mounted.current && current === operation.current) setBusy(false);
    }
  };

  const close = () => {
    operation.current += 1;
    pending.current = false;
    setBusy(false);
    setFallback(false);
    setStatus('');
    button.current?.focus();
  };

  return <div className="detail-share" onKeyDown={event => {
    if (event.key === 'Escape' && fallback) { event.stopPropagation(); close(); }
  }}>
    <button ref={button} type="button" className="detail-share-button" onClick={share}
      aria-disabled={busy} aria-label={`Share ${name}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" focusable="false">
        <path d="M12 16V3m-4 4 4-4 4 4M5 12v8h14v-8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Share
    </button>
    <span className="detail-share-status" role="status">{status}</span>
    {fallback ? <div className="detail-share-fallback">
      <input aria-label={`Link to ${name}`} value={url} readOnly onFocus={event => event.target.select()} />
      <button type="button" className="detail-share-button" onClick={copy} disabled={busy}>Copy link</button>
      <button type="button" className="detail-share-button" onClick={close}>Close</button>
    </div> : null}
  </div>;
}
