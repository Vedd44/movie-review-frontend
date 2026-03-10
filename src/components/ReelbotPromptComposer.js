import React from "react";

function ReelbotPromptComposer({ label, helperText = "", suggestions = [], value, onChange, placeholder }) {
  return (
    <div className="pick-control-group pick-control-group--prompt">
      <div className="detail-description-label">{label}</div>
      {helperText ? <p className="prompt-composer-copy detail-secondary-text">{helperText}</p> : null}
      {suggestions.length ? (
        <div className="pick-prompt-suggestions">
          {suggestions.map((prompt) => (
            <button key={prompt} type="button" className="mood-rail-chip pick-prompt-chip" onClick={() => onChange(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
      <div className="pick-prompt-shell">
        <input
          type="text"
          className="pick-prompt-input"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

export default ReelbotPromptComposer;
