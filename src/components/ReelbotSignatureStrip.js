import React from "react";

const SIGNATURE_ITEMS = [
  { label: "Attention", value: "How dialed in you need to be" },
  { label: "Emotional Weight", value: "How light or heavy it feels" },
  { label: "Pace", value: "How quickly it tends to move" },
  { label: "Best With", value: "Who it tends to play best with" },
];

function ReelbotSignatureStrip({ className = "" }) {
  return (
    <div className={`reelbot-signature-strip${className ? ` ${className}` : ""}`}>
      {SIGNATURE_ITEMS.map((item) => (
        <div key={item.label} className="reelbot-signature-item">
          <span className="reelbot-signature-label">{item.label}</span>
          <span className="reelbot-signature-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export default ReelbotSignatureStrip;
