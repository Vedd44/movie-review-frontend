import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

const getEmbedUrl = (video) => {
  if (!video?.key) {
    return "";
  }

  if (video.site === "YouTube") {
    return `https://www.youtube.com/embed/${video.key}?autoplay=1&rel=0&modestbranding=1`;
  }

  return video.embed_url || video.url || "";
};

function TrailerModal({ isOpen, video, movieTitle, onClose }) {
  const embedUrl = useMemo(() => getEmbedUrl(video), [video]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !embedUrl) {
    return null;
  }

  return createPortal(
    <div className="trailer-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="trailer-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${movieTitle || "Movie"} trailer`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="trailer-modal-head">
          <div>
            <div className="detail-description-label">Trailer</div>
            <h2 className="trailer-modal-title">{video?.name || `Watch the trailer for ${movieTitle || "this movie"}`}</h2>
            <p className="detail-secondary-text trailer-modal-copy">A quick look before you decide whether this is tonight&apos;s pick.</p>
          </div>
          <button type="button" className="trailer-modal-close" onClick={onClose} aria-label="Close trailer">
            Close
          </button>
        </div>

        <div className="trailer-modal-frame-wrap">
          <iframe
            className="trailer-modal-frame"
            src={embedUrl}
            title={`${movieTitle || "Movie"} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

export default TrailerModal;
