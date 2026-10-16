import React from "react";

export default function PickRequestContext({ prompt, onEdit, onReset, includeTheatrical = false, disabled = false }) {
  return <div className="pick-request-context picker-request">
    <div className="picker-request-copy"><p>{prompt || "Surprise me with something worth watching"}</p>{includeTheatrical ? <span className="picker-request-scope">Search includes theater-only movies</span> : null}</div>
    <div className="picker-request-actions">
      <button type="button" disabled={disabled} onClick={onEdit}>Edit</button>
      {onReset ? <button type="button" disabled={disabled} onClick={onReset}>Start fresh</button> : null}
    </div>
  </div>;
}
