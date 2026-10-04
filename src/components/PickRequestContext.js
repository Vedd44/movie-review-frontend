import React from "react";

export default function PickRequestContext({ prompt, onEdit, onReset, disabled = false }) {
  return <div className="pick-request-context picker-request">
    <div className="picker-request-copy"><span>Your request</span><p>{prompt || "Surprise me with something worth watching"}</p></div>
    <div className="picker-request-actions">
      <button type="button" disabled={disabled} onClick={onEdit}>Edit</button>
      {onReset ? <button type="button" disabled={disabled} onClick={onReset}>Start fresh</button> : null}
    </div>
  </div>;
}
