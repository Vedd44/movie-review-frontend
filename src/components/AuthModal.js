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
        <button type="button" className="auth-modal-close" onClick={closeAuthPrompt} aria-label="Close sign in dialog">
          ×
        </button>
        <AuthPanel
          titleId="auth-modal-title"
          title="Sign in to ReelBot"
          subtitle="Enter your email and we’ll send you a sign-in link. No password needed."
          ctaLabel="Send sign-in link"
          onComplete={closeAuthPrompt}
        />
      </div>
    </div>
  );
}

export default AuthModal;
