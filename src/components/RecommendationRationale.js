import React from "react";

function RecommendationRationale({ rationale, collapsible = false }) {
  if (!rationale?.decisionSentence) {
    return null;
  }

  return (
    <section className={`recommendation-rationale${collapsible ? " recommendation-rationale--compact" : ""}`}>
      <div className="recommendation-rationale-head">
        <h4 className="recommendation-rationale-title">Why it works</h4>
      </div>
      {rationale.contextAnchor ? (
        <p className="recommendation-rationale-why-now">{rationale.contextAnchor}</p>
      ) : null}
      <p className="recommendation-rationale-copy">{rationale.decisionSentence}</p>
    </section>
  );
}

export default RecommendationRationale;
