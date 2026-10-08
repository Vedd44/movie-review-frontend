import React, { useEffect, useState } from 'react';
import './HomeHeadline.css';

export const HEADLINE_PHRASES = Object.freeze([
  "something that'll keep me guessing.",
  'a movie everyone will love.',
  "something that'll make me laugh.",
  "something I've never heard of.",
  "a movie I won't stop thinking about.",
]);
export const HEADLINE_HOLD_MS = 4000;
export const HEADLINE_SEQUENCE_LENGTH = 3;
export const headlineRequest = phrase => phrase.charAt(0).toUpperCase() + phrase.slice(1).replace(/\.$/, '');

export default function HomeHeadline({ onSelect, paused = false }) {
  // Choose one starting point per visit, then show two more complete examples and settle.
  const [start] = useState(() => Math.floor(Math.random() * HEADLINE_PHRASES.length));
  const [step, setStep] = useState(0);
  const [settled, setSettled] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const phrase = HEADLINE_PHRASES[(start + step) % HEADLINE_PHRASES.length];
  const previousPhrase = HEADLINE_PHRASES[(start + step - 1 + HEADLINE_PHRASES.length) % HEADLINE_PHRASES.length];
  const finished = step === HEADLINE_SEQUENCE_LENGTH - 1;
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
    const timer = window.setTimeout(() => setStep(current => current + 1), HEADLINE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [finished, hidden, step, staticText]);

  return <><h1 id="home-hero-title" className="rb-conversation-headline" aria-live="off">
    <span className="headline-intro">I want to watch...</span>
    <button type="button" className={`headline-phrase${staticText ? ' is-settled' : ''}${hidden ? ' is-hidden' : ''}`} aria-label={`Use this example: ${phrase}`}
      aria-controls="pick-prompt-input" aria-describedby="headline-example-help"
      onPointerEnter={() => setSettled(true)} onFocus={() => setSettled(true)}
      onClick={() => { setSettled(true); onSelect(headlineRequest(phrase)); }}>
      {HEADLINE_PHRASES.map(example => <span key={example} className="headline-phrase-measure" aria-hidden="true">{example}</span>)}
      {step > 0 && !staticText && <span key={`previous-${step}`} className="headline-phrase-outgoing" aria-hidden="true">{previousPhrase}</span>}
      <span key={step} className={`headline-phrase-visible${step > 0 ? ' is-entering' : ''}`} aria-hidden="true">{phrase}</span>
    </button>
  </h1>
    <span id="headline-example-help" className="sr-only">Adds this example to an empty request. Your existing text stays unchanged. You can edit it before finding a movie.</span>
  </>;
}
