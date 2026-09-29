import React from "react";

function RecommendationRationale({ rationale, collapsible = false }) {
  if (!rationale?.decisionSentence) {
    return null;
  }

  return (
    <section className={`recommendation-rationale${collapsible ? " recommendation-rationale--compact" : ""}`}>
      <div className="recommendation-rationale-head">
        <h4 className="recommendation-rationale-title">ReelBot’s Take</h4>
      </div>
       <p className="recommendation-rationale-copy">{rationale.decisionSentence}</p>
    </section>
  );
}

export default RecommendationRationale;
