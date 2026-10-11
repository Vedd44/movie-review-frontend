import React, { useEffect, useRef, useState } from 'react';
import './HomeHeadline.css';

export const HEADLINE_PHRASES = Object.freeze([
  "something that'll keep me guessing.",
  'a movie everyone will love.',
  "something that'll make me laugh.",
  "something I've never heard of.",
  "a movie I won't stop thinking about.",
]);
export const HEADLINE_START_MS = 180;
export const HEADLINE_CHARACTER_MS = 36;
export const headlineRequest = phrase => phrase.charAt(0).toUpperCase() + phrase.slice(1).replace(/\.$/, '');

export default function HomeHeadline({ onSelect, paused = false, interactionVersion = 0 }) {
  // Reveal one complete example per mounted visit. Ordinary rerenders never restart it.
  const [start] = useState(() => Math.floor(Math.random() * HEADLINE_PHRASES.length));
  const [settled, setSettled] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const initialInteractionVersion = useRef(interactionVersion);
  const requestChanged = interactionVersion !== initialInteractionVersion.current;
  const phrase = HEADLINE_PHRASES[start];
  const staticText = settled || paused || reducedMotion || requestChanged;

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => { setReducedMotion(motion.matches); if (motion.matches) setSettled(true); };
    const updateVisibility = () => setHidden(document.hidden);
    // Restored text, autofocus, hover and scrolling are not request editing.
    // Let this short reveal run until the visitor actually changes the request.
    const settleOnInput = event => {
      if (event.target?.id === 'pick-prompt-input') setSettled(true);
    };
    motion.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    document.addEventListener('input', settleOnInput);
    return () => {
      motion.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
      document.removeEventListener('input', settleOnInput);
    };
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || requestChanged) setSettled(true);
  }, [paused, reducedMotion, requestChanged]);

  useEffect(() => {
    if (staticText) return undefined;
    // CSS animation events can be lost after backgrounding or style changes.
    // One bounded completion timer guarantees the whole example remains usable.
    const finish = setTimeout(() => setSettled(true), HEADLINE_START_MS + (phrase.length - 1) * HEADLINE_CHARACTER_MS + 100);
    return () => clearTimeout(finish);
  }, [phrase, staticText]);

  return <><h1 id="home-hero-title" className="rb-conversation-headline" aria-live="off">
    <span className="headline-intro">I want to watch...</span>
    <button type="button" className={`headline-phrase${staticText ? ' is-settled' : ''}${hidden ? ' is-hidden' : ''}`} aria-label={`Use this example: ${phrase}`}
      aria-controls="pick-prompt-input" aria-describedby="headline-example-help" disabled={paused}
      onFocus={() => setSettled(true)}
      onClick={() => { setSettled(true); onSelect?.(headlineRequest(phrase)); }}>
      {HEADLINE_PHRASES.map(example => <span key={example} className="headline-phrase-measure" aria-hidden="true">{example}</span>)}
      <span className="headline-phrase-visible" aria-hidden="true">
        {/* Keep every character in layout from the first paint: wrapping never shifts as it types. */}
        {Array.from(phrase).map((character, index) => <span key={index} className="headline-character"
          style={{ animationDelay: `${HEADLINE_START_MS + index * HEADLINE_CHARACTER_MS}ms` }}
          onAnimationEnd={index === phrase.length - 1 ? () => setSettled(true) : undefined}>{character}</span>)}
      </span>
    </button>
  </h1>
    <span id="headline-example-help" className="sr-only">Uses this example as your request, replacing any existing text. You can edit it before finding a movie.</span>
  </>;
}
