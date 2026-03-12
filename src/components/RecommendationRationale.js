import React from "react";

function RecommendationRationale({ rationale, collapsible = false }) {
  if (!rationale?.whyRecommended?.length) {
    return null;
  }

  if (!collapsible) {
    return (
      <section className="recommendation-rationale">
        <div className="recommendation-rationale-list-block">
          <div className="detail-description-label">{rationale.whyTitle || "Why this works"}</div>
          <ul className="recommendation-rationale-list">
            {rationale.whyRecommended.slice(0, 2).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <details className="recommendation-rationale recommendation-rationale--collapsible">
      <summary className="recommendation-rationale-toggle">Why this one?</summary>
      <div className="recommendation-rationale-list-block">
        <div className="detail-description-label">{rationale.whyTitle || "Why this works"}</div>
        <ul className="recommendation-rationale-list">
          {rationale.whyRecommended.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export default RecommendationRationale;
