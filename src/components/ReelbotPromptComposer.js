import React from "react";

function ReelbotPromptComposer({ label, helperText = "", suggestions = [], value, onChange, placeholder, errorText = "" }) {
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
          className={`pick-prompt-input${errorText ? " is-invalid" : ""}`}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={errorText ? "true" : "false"}
          aria-describedby={errorText ? "pick-prompt-validation" : undefined}
        />
      </div>
      {errorText ? (
        <p id="pick-prompt-validation" className="pick-prompt-validation" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

export default ReelbotPromptComposer;
