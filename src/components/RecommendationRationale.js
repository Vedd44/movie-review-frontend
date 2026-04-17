import React from "react";

function RecommendationRationale({ rationale, collapsible = false }) {
  if (!rationale?.decisionSentence) {
    return null;
  }

  return (
    <section className={`recommendation-rationale${collapsible ? " recommendation-rationale--compact" : ""}`}>
      {rationale.decisionVerdict ? <h4 className="recommendation-rationale-title">{rationale.decisionVerdict}</h4> : null}
      {rationale.contextAnchor ? (
        <p className="recommendation-rationale-why-now">{rationale.contextAnchor}</p>
      ) : null}
      <p className="recommendation-rationale-copy">{rationale.decisionSentence}</p>
    </section>
  );
}

export default RecommendationRationale;
