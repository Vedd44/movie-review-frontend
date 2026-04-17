import React, { useEffect } from "react";
import AuthPanel from "./AuthPanel";
import { useAuth } from "../context/AuthContext";

const CLOSE_TRANSIENT_UI_EVENT = "reelbot:close-transient-ui";

function AuthModal() {
  const { authPromptOpen, closeAuthPrompt } = useAuth();

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
        <AuthPanel
          titleId="auth-modal-title"
          title="Sign in to ReelBot"
          subtitle="Enter your email and we’ll send you a sign-in link."
          ctaLabel="Send sign-in link"
          onComplete={closeAuthPrompt}
        />
      </div>
    </div>
  );
}

export default AuthModal;
