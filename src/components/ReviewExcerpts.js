import React from 'react';
import { reviewExcerptText, reviewSourceUrl } from '../reviewPresentation';

export default function ReviewExcerpts({ highlights = {} }) {
  const reviews = [highlights.positive, highlights.negative]
    .map((review, index) => ({ review, index, text: reviewExcerptText(review?.content) }))
    .filter(({ text }) => text);
  if (!reviews.length) return null;
  return (
    <section className="detail-info-card detail-info-card--split" aria-labelledby="viewer-reviews-heading">
      <div className="detail-section-head detail-section-head--facts">
        <div>
          <h2 id="viewer-reviews-heading" className="detail-section-title">Viewer reviews</h2>
          <p className="detail-secondary-text">Selected excerpts from TMDB user reviews. Ratings reflect each reviewer’s opinion.</p>
        </div>
        {highlights.count ? <div className="results-count">{highlights.count} reviews</div> : null}
      </div>
      <div className="review-split-grid">
        {reviews.map(({ review, index, text }) => {
          const author = review.author || highlights.source || 'TMDB reviewer';
          const url = reviewSourceUrl(review.url);
          return (
            <article className="review-split-card" key={index}>
              <div className="review-split-kicker">Review excerpt</div>
              <p className="review-split-quote">“{text}”</p>
              <div className="review-split-meta">
                {[author, typeof review.rating === 'number' && Number.isFinite(review.rating) ? `${review.rating}/10` : null].filter(Boolean).join(' • ')}
              </div>
              {url ? <a className="detail-text-action" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Read full review on TMDB by ${author} (opens in a new tab)`}>Read full review on TMDB</a> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
