import React, { useRef } from "react";

function ReelbotPromptComposer({
  label,
  helperText = "",
  introText = "",
  suggestions = [],
  activeSuggestion = "",
  inputId,
  value,
  onSuggestionSelect,
  onInputChange,
  onKeyDown,
  onFocus,
  onBlur,
  placeholder,
  errorText = "",
  maxLength = 500,
}) {
  const inputRef = useRef(null);
  const inputShellRef = useRef(null);

  const handleSuggestionClick = (prompt) => {
    // Choosing a suggestion should fill the field without summoning a software keyboard.
    inputRef.current?.blur();
    onSuggestionSelect?.(prompt);

    window.requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 720px)").matches) {
        inputShellRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  };

  const handleClear = () => {
    onInputChange?.("");
    inputRef.current?.blur();
  };

  const handleInputChange = (event) => {
    onInputChange?.(event.target.value);
  };
  return (
    <div className="pick-control-group pick-control-group--prompt">
      {label ? <div className="detail-description-label">{label}</div> : null}
      {helperText ? <p className="prompt-composer-copy detail-secondary-text">{helperText}</p> : null}
      {introText ? <div className="prompt-composer-intro">{introText}</div> : null}
      <div ref={inputShellRef} className="pick-prompt-shell">
        <input
          id={inputId}
          aria-label={label || "Describe the movie you want"}
          type="text"
          className={`pick-prompt-input${errorText ? " is-invalid" : ""}`}
          placeholder={placeholder}
          ref={inputRef}
          value={value}
          maxLength={maxLength}
          onChange={handleInputChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          aria-invalid={errorText ? "true" : "false"}
          aria-describedby={errorText ? "pick-prompt-validation" : undefined}
        />
        {value ? (
          <button
            type="button"
            className="pick-prompt-clear"
            aria-label="Clear prompt"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClear}
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>
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
      {errorText ? (
        <p id="pick-prompt-validation" className="pick-prompt-validation" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

export default ReelbotPromptComposer;
