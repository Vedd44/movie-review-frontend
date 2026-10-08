import React, { useEffect, useState } from 'react';
import './HomeHeadline.css';

export const HEADLINE_PHRASES = Object.freeze([
  "something that'll keep me guessing.",
  'a movie everyone will love.',
  "something that'll make me laugh.",
  "something I've never heard of.",
  "a movie I won't stop thinking about.",
]);
export const HEADLINE_HOLD_MS = 3000;
export const HEADLINE_TYPE_MS = 65;
export const headlineRequest = phrase => phrase.charAt(0).toUpperCase() + phrase.slice(1).replace(/\.$/, '');

export default function HomeHeadline({ onSelect, paused = false }) {
  // Choose one starting point per visit, then make one predictable pass.
  const [start] = useState(() => Math.floor(Math.random() * HEADLINE_PHRASES.length));
  const [progress, setProgress] = useState(() => ({ step: 0, chars: HEADLINE_PHRASES[start].length }));
  const [settled, setSettled] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const phrase = HEADLINE_PHRASES[(start + progress.step) % HEADLINE_PHRASES.length];
  const complete = progress.chars >= phrase.length;
  const finished = progress.step === HEADLINE_PHRASES.length - 1 && complete;
  const staticText = settled || paused || reducedMotion;

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => { setReducedMotion(motion.matches); if (motion.matches) setSettled(true); };
    const updateVisibility = () => setHidden(document.hidden);
    // Once the visitor starts using the site, let their request take the focus.
    const settle = () => setSettled(true);
    const interactions = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    motion.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    interactions.forEach(event => document.addEventListener(event, settle, { passive: true, once: true }));
    return () => {
      motion.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
      interactions.forEach(event => document.removeEventListener(event, settle));
    };
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) setSettled(true);
  }, [paused, reducedMotion]);

  useEffect(() => {
    if (staticText || hidden || finished) return undefined;
    const timer = window.setTimeout(() => setProgress(current => complete
      ? { step: current.step + 1, chars: 1 }
      : { ...current, chars: current.chars + 1 }), complete ? HEADLINE_HOLD_MS : HEADLINE_TYPE_MS);
    return () => window.clearTimeout(timer);
  }, [complete, finished, hidden, progress, staticText]);

  return <><h1 id="home-hero-title" className="rb-conversation-headline" aria-live="off">
    <span className="headline-intro">I want to watch...</span>
    <button type="button" className="headline-phrase" aria-label={`Use this example: ${phrase}`}
      aria-controls="pick-prompt-input" aria-describedby="headline-example-help"
      onPointerEnter={() => setSettled(true)} onFocus={() => setSettled(true)}
      onClick={() => { setSettled(true); onSelect(headlineRequest(phrase)); }}>
      {HEADLINE_PHRASES.map(example => <span key={example} className="headline-phrase-measure" aria-hidden="true">{example}<span className="headline-cursor" /></span>)}
      <span className="headline-phrase-visible" aria-hidden="true">
        {staticText ? phrase : phrase.slice(0, progress.chars)}
        <span className={`headline-cursor${staticText || hidden || finished ? ' is-resting' : ''}`} />
      </span>
    </button>
  </h1>
    <span id="headline-example-help" className="sr-only">Adds this example to an empty request. Your existing text stays unchanged. You can edit it before finding a movie.</span>
  </>;
}
