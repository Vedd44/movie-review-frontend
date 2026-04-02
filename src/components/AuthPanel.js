import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { validateEmail, validatePassword } from "../authValidation";

const EMAIL_LINK_VIEW = "email-link";
const PASSWORD_LOGIN_VIEW = "password-login";
const PASSWORD_SIGNUP_VIEW = "password-signup";
const FORGOT_PASSWORD_VIEW = "forgot-password";

function AuthPanel({
  compact = false,
  title = "",
  titleId = "",
  subtitle = "",
  ctaLabel = "Send sign-in link",
  onComplete = null,
}) {
  const {
    user,
    loading: authLoading,
    sendMagicLink,
    signInWithPassword,
    signUpWithPassword,
    sendPasswordReset,
    clearAuthError,
  } = useAuth();
  const [view, setView] = useState(PASSWORD_LOGIN_VIEW);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [successState, setSuccessState] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setSuccessState(null);
  }, [view]);

  const usingPasswordFlow = view !== EMAIL_LINK_VIEW;
  const isSignupView = view === PASSWORD_SIGNUP_VIEW;
  const isForgotPasswordView = view === FORGOT_PASSWORD_VIEW;

  const helperCopy = useMemo(() => {
    if (user?.email) {
      return `Signed in as ${user.email}`;
    }

    if (view === PASSWORD_LOGIN_VIEW) {
      return "Use your email and password to sign in.";
    }

    if (view === PASSWORD_SIGNUP_VIEW) {
      return "Save your picks and pick up where you left off across devices.";
    }

    if (view === FORGOT_PASSWORD_VIEW) {
      return "Enter your email and we’ll send you a reset link.";
    }

    return subtitle || "Enter your email and we’ll send you a sign-in link. No password needed.";
  }, [subtitle, user?.email, view]);

  const modeTitle = useMemo(() => {
    if (view === PASSWORD_LOGIN_VIEW) {
      return "Log in";
    }

    if (view === PASSWORD_SIGNUP_VIEW) {
      return "Create account";
    }

    if (view === FORGOT_PASSWORD_VIEW) {
      return "Reset your password";
    }

    return "Email sign-in";
  }, [view]);

  const resetFormState = () => {
    setPassword("");
    setConfirmPassword("");
    setDisplayName("");
    setError("");
    setSuccessState(null);
    clearAuthError();
  };

  const handleViewChange = (nextView) => {
    setView(nextView);
    resetFormState();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    console.log("Auth click triggered");

    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setError(emailError);
      return;
    }

    if (loading) {
      return;
    }

    const passwordError = usingPasswordFlow && !isForgotPasswordView ? validatePassword(password) : "";
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if ((isSignupView || view === FORGOT_PASSWORD_VIEW) && !normalizedEmail) {
      setError("Enter a valid email");
      return;
    }

    if (isSignupView && password !== confirmPassword) {
      setError("Passwords need to match");
      return;
    }

    setLoading(true);
    setSuccessState(null);
    setError("");
    clearAuthError();

    try {
      if (view === EMAIL_LINK_VIEW) {
        const response = await sendMagicLink(normalizedEmail);
        console.log("Supabase response:", response);
        setSuccessState({
          title: "Check your email",
          body: "We just sent you a sign-in link.",
          resetLabel: "Send another sign-in link",
        });
      } else if (view === PASSWORD_LOGIN_VIEW) {
        await signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (typeof onComplete === "function") {
          onComplete();
        }
      } else if (view === PASSWORD_SIGNUP_VIEW) {
        const response = await signUpWithPassword({
          email: normalizedEmail,
          password,
          displayName,
        });
        const hasSession = Boolean(response?.data?.session);

        if (!hasSession) {
          setSuccessState({
            title: "Check your email",
            body: "Your account is almost ready. Confirm your email to finish signing in.",
            resetLabel: "Use a different email",
          });
        } else if (typeof onComplete === "function") {
          onComplete();
        }
      } else if (view === FORGOT_PASSWORD_VIEW) {
        await sendPasswordReset(normalizedEmail);
        setSuccessState({
          title: "Check your email",
          body: "We sent you a password reset link.",
          resetLabel: "Send another reset link",
        });
      }
    } catch (submitError) {
      console.error("Error with ReelBot auth flow:", submitError);
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = (() => {
    if (loading) {
      return "Sending...";
    }

    if (view === PASSWORD_LOGIN_VIEW) {
      return "Log in";
    }

    if (view === PASSWORD_SIGNUP_VIEW) {
      return "Create account";
    }

    if (view === FORGOT_PASSWORD_VIEW) {
      return "Send reset link";
    }

    return ctaLabel;
  })();

  return (
    <div className={`auth-panel${compact ? " auth-panel--compact" : ""}`}>
      {title ? <div id={titleId || undefined} className="auth-panel-title">{title}</div> : null}

      {!user ? (
        <div className="auth-panel-switcher" role="tablist" aria-label="Sign-in options">
          <button
            type="button"
            role="tab"
            aria-selected={usingPasswordFlow}
            className={`auth-panel-switch${usingPasswordFlow ? " is-active" : ""}`}
            onClick={() => handleViewChange(PASSWORD_LOGIN_VIEW)}
          >
            Password
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!usingPasswordFlow}
            className={`auth-panel-switch${!usingPasswordFlow ? " is-active" : ""}`}
            onClick={() => handleViewChange(EMAIL_LINK_VIEW)}
          >
            Email sign-in
          </button>
        </div>
      ) : null}

      {usingPasswordFlow && !user ? (
        <div className="auth-panel-subnav" aria-label="Password account options">
          <button
            type="button"
            className={`auth-panel-subnav-link${view === PASSWORD_LOGIN_VIEW ? " is-active" : ""}`}
            onClick={() => handleViewChange(PASSWORD_LOGIN_VIEW)}
          >
            Log in
          </button>
          <button
            type="button"
            className={`auth-panel-subnav-link${view === PASSWORD_SIGNUP_VIEW ? " is-active" : ""}`}
            onClick={() => handleViewChange(PASSWORD_SIGNUP_VIEW)}
          >
            Create account
          </button>
          <button
            type="button"
            className={`auth-panel-subnav-link${view === FORGOT_PASSWORD_VIEW ? " is-active" : ""}`}
            onClick={() => handleViewChange(FORGOT_PASSWORD_VIEW)}
          >
            Forgot password
          </button>
        </div>
      ) : null}

      {!user ? <div className="auth-panel-mode-title">{modeTitle}</div> : null}
      <p className="auth-panel-copy" aria-live="polite">{helperCopy}</p>
      {error ? <p className="error-message auth-panel-error">{error}</p> : null}

      {successState ? (
        <div className="auth-panel-success-block" aria-live="polite">
          <div className="auth-panel-success-title">{successState.title}</div>
          <p className="auth-panel-success">{successState.body}</p>
          <button
            type="button"
            className="reelbot-inline-button"
            onClick={() => {
              setSuccessState(null);
              setError("");
            }}
          >
            {successState.resetLabel}
          </button>
        </div>
      ) : !user ? (
        <form className="auth-panel-form auth-panel-form--stacked" onSubmit={handleSubmit}>
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

          {view === PASSWORD_SIGNUP_VIEW ? (
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name (optional)"
              aria-label="Display name"
              disabled={loading || authLoading}
            />
          ) : null}

          {usingPasswordFlow && !isForgotPasswordView ? (
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Password"
              aria-label="Password"
              disabled={loading || authLoading}
            />
          ) : null}

          {view === PASSWORD_SIGNUP_VIEW ? (
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Confirm password"
              aria-label="Confirm password"
              disabled={loading || authLoading}
            />
          ) : null}

          <button type="submit" className="reelbot-inline-button reelbot-inline-button--solid" disabled={loading || authLoading}>
            {submitLabel}
          </button>
        </form>
      ) : null}

      {!user ? (
        <div className="auth-panel-actions auth-panel-actions--links">
          {view === EMAIL_LINK_VIEW ? (
            <button type="button" className="auth-panel-link" onClick={() => handleViewChange(PASSWORD_LOGIN_VIEW)}>
              Use password instead
            </button>
          ) : (
            <button type="button" className="auth-panel-link" onClick={() => handleViewChange(EMAIL_LINK_VIEW)}>
              Use email sign-in instead
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default AuthPanel;
