export default function ArtworkFallback({ className = "", label = "Artwork unavailable" }) {
  return <div className={`artwork-fallback ${className}`} role="img" aria-label={label}>
    <img src="/brand/reelbot-icon.svg" alt="" aria-hidden="true" width="36" height="42" />
  </div>;
}
