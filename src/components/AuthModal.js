import React, { useEffect } from "react";
import AuthPanel from "./AuthPanel";
import { useAuth } from "../context/AuthContext";

const CLOSE_TRANSIENT_UI_EVENT = "reelbot:close-transient-ui";

function AuthModal() {
  const { authPromptOpen, authPromptSource, closeAuthPrompt } = useAuth();
  const isSavePrompt = authPromptSource === "save_movie";

  useEffect(() => {
    if (!authPromptOpen) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeAuthPrompt();
      }
    };

    const handleCloseTransientUi = () => closeAuthPrompt();

    window.addEventListener("keydown", handleEscape);
    window.addEventListener(CLOSE_TRANSIENT_UI_EVENT, handleCloseTransientUi);
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener(CLOSE_TRANSIENT_UI_EVENT, handleCloseTransientUi);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [authPromptOpen, closeAuthPrompt]);

  if (!authPromptOpen) {
    return null;
  }

  return (
    <div className="auth-modal-backdrop" onClick={closeAuthPrompt} role="presentation">
      <div className="auth-modal-shell" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="auth-modal-close" onClick={closeAuthPrompt} aria-label="Close sign in dialog">
          ×
        </button>
        <div className="auth-value-proposition">
          <div className="browse-kicker">{isSavePrompt ? "Save this movie" : "Your ReelBot"}</div>
          <h2 id="auth-modal-title">Make ReelBot yours.</h2>
          <p>{isSavePrompt ? "Create an account to keep this pick and pick up where you left off." : "Save picks, keep track of what you’ve watched, and get better recommendations over time."}</p>
          <ul>
            <li><strong>Pick up where you left off.</strong><span>Your latest picks stay with you across devices.</span></li>
            <li><strong>Remember what worked.</strong><span>Save movies you liked — and skip ones you don’t want again.</span></li>
            <li><strong>Less repetition.</strong><span>ReelBot can use your history to make future picks more useful.</span></li>
          </ul>
        </div>
        <AuthPanel
          initialView={isSavePrompt ? "email-link" : "password-login"}
          titleId="auth-modal-title"
          subtitle="We’ll send you a sign-in link."
          ctaLabel="Send sign-in link"
          onComplete={closeAuthPrompt}
        />
      </div>
    </div>
  );
}

export default AuthModal;
