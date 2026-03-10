import React from "react";

function RecommendationRationale({ rationale, summary }) {
  if (!rationale) {
    return null;
  }

  return (
    <section className="recommendation-rationale">
      <div className="recommendation-rationale-head">
        <div>
          <div className="detail-description-label">{rationale.title}</div>
          <h3 className="recommendation-rationale-title">{rationale.heading}</h3>
        </div>
        <div className="recommendation-confidence-pill">{rationale.confidenceLabel}</div>
      </div>

      {summary ? (
        <div className="recommendation-rationale-summary-block">
          <div className="detail-description-label">{rationale.assistantLabel || "ReelBot’s take"}</div>
          <p className="detail-secondary-text recommendation-rationale-copy">{summary}</p>
        </div>
      ) : null}

      <div className="recommendation-criteria-block" aria-label="Selected criteria">
        <div className="detail-description-label">{rationale.criteriaTitle || "Based on"}</div>
        <div className="recommendation-criteria-row">
          {rationale.criteria.map((item) => (
            <span key={item.key} className="recommendation-criteria-chip">
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="recommendation-confidence-block">
        <div className="recommendation-confidence-row">
          <span className="recommendation-confidence-label">{rationale.scoreLabel || "How close this feels"}</span>
          <span className="recommendation-confidence-value">{rationale.confidenceScore}%</span>
        </div>
        <div className="recommendation-confidence-track" aria-hidden="true">
          <span className="recommendation-confidence-fill" style={{ width: `${rationale.confidenceScore}%` }} />
        </div>
      </div>

      <div className="recommendation-rationale-list-block">
        <div className="detail-description-label">{rationale.whyTitle || "Why this works"}</div>
        <ul className="recommendation-rationale-list">
          {rationale.whyRecommended.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default RecommendationRationale;
