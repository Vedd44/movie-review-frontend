import React, { useRef } from "react";

function ReelbotPromptComposer({
  label,
  helperText = "",
  suggestions = [],
  activeSuggestion = "",
  value,
  onSuggestionSelect,
  onInputChange,
  placeholder,
  errorText = "",
}) {
  const inputRef = useRef(null);
  const inputShellRef = useRef(null);

  const handleSuggestionClick = (prompt) => {
    onSuggestionSelect?.(prompt);

    window.requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 720px)").matches) {
        inputShellRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      if (inputRef.current) {
        inputRef.current.focus();
        const nextLength = prompt.length;
        inputRef.current.setSelectionRange(nextLength, nextLength);
      }
    });
  };

  const handleInputChange = (event) => {
    onInputChange?.(event.target.value);
  };
  return (
    <div className="pick-control-group pick-control-group--prompt">
      <div className="detail-description-label">{label}</div>
      {helperText ? <p className="prompt-composer-copy detail-secondary-text">{helperText}</p> : null}
      {suggestions.length ? (
        <div className="pick-prompt-suggestions">
          {suggestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className={`mood-rail-chip pick-prompt-chip${activeSuggestion === prompt ? " is-active" : ""}`}
              onClick={() => handleSuggestionClick(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={inputShellRef} className="pick-prompt-shell">
        <input
          type="text"
          className={`pick-prompt-input${errorText ? " is-invalid" : ""}`}
          placeholder={placeholder}
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
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
