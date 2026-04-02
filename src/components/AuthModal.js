import React, { useEffect } from "react";
import AuthPanel from "./AuthPanel";
import { useAuth } from "../context/AuthContext";

function AuthModal() {
  const { authPromptOpen, closeAuthPrompt } = useAuth();

  useEffect(() => {
    if (!authPromptOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeAuthPrompt();
      }
    };

    window.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [authPromptOpen, closeAuthPrompt]);

  if (!authPromptOpen) {
    return null;
  }

  return (
    <div className="auth-modal-backdrop" onClick={closeAuthPrompt} role="presentation">
      <div className="auth-modal-shell" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="auth-modal-close" onClick={closeAuthPrompt} aria-label="Close save your picks dialog">
          ×
        </button>
        <AuthPanel
          titleId="auth-modal-title"
          title="Save your picks"
          subtitle="Enter your email and we’ll send you a quick sign-in link. No password needed. Your picks, history, and preferences will stay saved across devices."
          ctaLabel="Send link"
          onComplete={closeAuthPrompt}
        />
      </div>
    </div>
  );
}

export default AuthModal;
