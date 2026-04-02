import React, { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthPanel({ compact = false, title = "", titleId = "", subtitle = "", ctaLabel = "Send link", onComplete = null }) {
  const { user, loading: authLoading, sendMagicLink, clearAuthError } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const helperCopy = useMemo(() => {
    if (user?.email) {
      return `Signed in as ${user.email}`;
    }

    if (success) {
      return "We just sent you a sign-in link.";
    }

    return subtitle || "Enter your email and we’ll send you a quick sign-in link. No password needed. Your picks, history, and preferences will stay saved across devices.";
  }, [success, subtitle, user?.email]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    console.log("Auth click triggered");

    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email");
      return;
    }

    if (loading) {
      return;
    }

    setLoading(true);
    setSuccess(false);
    setError("");
    clearAuthError();
    try {
      const response = await sendMagicLink(normalizedEmail);
      console.log("Supabase response:", response);
      setSuccess(true);
    } catch (error) {
      console.error("Error sending ReelBot magic link:", error);
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-panel${compact ? " auth-panel--compact" : ""}`}>
      {title ? <div id={titleId || undefined} className="auth-panel-title">{title}</div> : null}
      <p className="auth-panel-copy" aria-live="polite">{helperCopy}</p>
      {error ? <p className="error-message auth-panel-error">{error}</p> : null}
      {success ? (
        <div className="auth-panel-success-block" aria-live="polite">
          <div className="auth-panel-success-title">Check your email</div>
          <p className="auth-panel-success">We just sent you a sign-in link.</p>
          <button
            type="button"
            className="reelbot-inline-button"
            onClick={() => {
              setSuccess(false);
              setError("");
            }}
          >
            Didn&apos;t get it? Try again
          </button>
        </div>
      ) : !user ? (
        <form className="auth-panel-form" onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) {
                setError("");
              }
            }}
            placeholder="Email address"
            aria-label="Email address"
            disabled={loading || authLoading}
            autoFocus
          />
          <button type="submit" className="reelbot-inline-button reelbot-inline-button--solid" disabled={loading || authLoading}>
            {loading ? "Sending..." : ctaLabel}
          </button>
        </form>
      ) : null}
    </div>
  );
}

export default AuthPanel;
