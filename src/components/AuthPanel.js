import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { validateEmail, validatePassword } from "../authValidation";
import { authErrorMessage } from "../authFlow";
import { getAuthProviders } from "../lib/supabaseClient";

const EMAIL_LINK_VIEW = "email-link";
const PASSWORD_LOGIN_VIEW = "password-login";
const PASSWORD_SIGNUP_VIEW = "password-signup";
const FORGOT_PASSWORD_VIEW = "forgot-password";

function AuthPanel({
  compact = false,
  initialView = PASSWORD_LOGIN_VIEW,
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
    resendConfirmation,
    signInWithGoogle,
    authNotice,
    clearAuthNotice,
  } = useAuth();
  const [view, setView] = useState(initialView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successState, setSuccessState] = useState(null);
  const [error, setError] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    getAuthProviders().then(providers => { if (active) setGoogleEnabled(Boolean(providers.google)); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!resendSeconds) return undefined;
    const timer = window.setTimeout(() => setResendSeconds(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

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
      return "Pick up where you left off.";
    }

    if (view === PASSWORD_SIGNUP_VIEW) {
      return "Your picks and movie history will follow you across devices.";
    }

    if (view === FORGOT_PASSWORD_VIEW) {
      return "Enter your email and we’ll send you a reset link.";
    }

    return subtitle || "We’ll send a secure sign-in link to your email.";
  }, [subtitle, user?.email, view]);

  const modeTitle = useMemo(() => {
    if (view === PASSWORD_LOGIN_VIEW) {
      return "Sign in";
    }

    if (view === PASSWORD_SIGNUP_VIEW) {
      return "Create account";
    }

    if (view === FORGOT_PASSWORD_VIEW) {
      return "Reset your password";
    }

    return "Email me a sign-in link";
  }, [view]);

  useEffect(() => {
    if (!user && !successState) {
      emailInputRef.current?.focus();
    }
  }, [successState, user, view]);

  const resetFormState = () => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setError("");
    setSuccessState(null);
    clearAuthError();
    clearAuthNotice?.();
    setNeedsConfirmation(false);
  };

  const handleViewChange = (nextView) => {
    setView(nextView);
    resetFormState();
  };

  const handleResend = async () => {
    if (loading || resendSeconds) return;
    const address = email.trim().toLowerCase();
    if (validateEmail(address)) { setError("Enter a valid email"); return; }
    setLoading(true); setError("");
    try {
      const kind = successState?.kind || "signup";
      if (kind === "recovery") await sendPasswordReset(address);
      else if (kind === "email-link") await sendMagicLink(address);
      else await resendConfirmation(address);
      setSuccessState({ kind, title: "Check your email", body: `A new ${kind === "signup" ? "confirmation" : kind === "recovery" ? "reset" : "sign-in"} link is on the way to ${address}.`, resetLabel: "Use a different email" });
      setResendSeconds(60); setNeedsConfirmation(false);
    } catch (e) { setError(authErrorMessage(e, "We couldn’t send the link. Try again.")); }
    finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    if (loading) return;
    setLoading(true); setError(""); clearAuthNotice?.();
    try { await signInWithGoogle(); }
    catch (e) { setError(authErrorMessage(e, "We couldn’t open Google sign-in. Try again or use email.")); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setError(emailError);
      return;
    }

    if (loading) {
      return;
    }

    const passwordError = isSignupView ? validatePassword(password) : view === PASSWORD_LOGIN_VIEW && !password ? "Enter your password" : "";
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
      clearAuthNotice?.();
      if (view === EMAIL_LINK_VIEW) {
        await sendMagicLink(normalizedEmail);
        setSuccessState({
          kind: "email-link",
          title: "Check your email",
          body: `We sent a sign-in link to ${normalizedEmail}.`,
          resetLabel: "Use a different email",
        });
        setResendSeconds(60);
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
        });
        const hasSession = Boolean(response?.data?.session);

        if (!hasSession) {
          setSuccessState({
            kind: "signup",
            title: "Check your email",
            body: `Confirm your email using the link sent to ${normalizedEmail}.`,
            resetLabel: "Use a different email",
          });
          setResendSeconds(60);
        } else if (typeof onComplete === "function") {
          onComplete();
        }
      } else if (view === FORGOT_PASSWORD_VIEW) {
        await sendPasswordReset(normalizedEmail);
        setSuccessState({
          kind: "recovery",
          title: "Check your email",
          body: `If there’s an account for ${normalizedEmail}, a reset link is on the way.`,
          resetLabel: "Use a different email",
        });
        setResendSeconds(60);
      }
    } catch (submitError) {
      setError(authErrorMessage(submitError, view === PASSWORD_LOGIN_VIEW ? "We couldn’t sign you in. Try again." : isSignupView ? "We couldn’t create your account. Try again." : "We couldn’t send the link. Try again."));
      if (view === PASSWORD_LOGIN_VIEW) {
        const message = String(submitError?.message || "").toLowerCase();
        if (message.includes("email not confirmed") || submitError?.code === "email_not_confirmed") { setError("Confirm your email before signing in."); setNeedsConfirmation(true); }
        else if (message.includes("invalid login credentials")) setError("Incorrect email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = (() => {
    if (loading) {
      if (view === PASSWORD_LOGIN_VIEW) return "Signing in…";
      if (view === PASSWORD_SIGNUP_VIEW) return "Creating account…";
      return "Sending link…";
    }

    if (view === PASSWORD_LOGIN_VIEW) {
      return "Sign in";
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

      {!user && usingPasswordFlow && !isForgotPasswordView ? (
        <div className="auth-panel-task-switcher" role="tablist" aria-label="Account task" onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const tabs = [...event.currentTarget.querySelectorAll("[role=tab]")];
          const index = tabs.indexOf(document.activeElement);
          tabs[event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]?.focus();
        }}>
          <button
            type="button"
            role="tab"
            aria-selected={view === PASSWORD_LOGIN_VIEW}
            tabIndex={view === PASSWORD_SIGNUP_VIEW ? -1 : 0}
            className={`auth-panel-task-switch${view === PASSWORD_LOGIN_VIEW ? " is-active" : ""}`}
            onClick={() => handleViewChange(PASSWORD_LOGIN_VIEW)}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === PASSWORD_SIGNUP_VIEW}
            tabIndex={view === PASSWORD_SIGNUP_VIEW ? 0 : -1}
            className={`auth-panel-task-switch${view === PASSWORD_SIGNUP_VIEW ? " is-active" : ""}`}
            onClick={() => handleViewChange(PASSWORD_SIGNUP_VIEW)}
          >
            Create account
          </button>
        </div>
      ) : null}

      {!user ? <div className="auth-panel-mode-title">{modeTitle}</div> : null}
      <p className="auth-panel-copy" aria-live="polite">{helperCopy}</p>
      {authNotice?.kind === "error" ? <p role="alert" className="auth-panel-error">{authNotice.message}</p> : null}
      {error ? <p className="error-message auth-panel-error">{error}</p> : null}
      {needsConfirmation ? <button type="button" className="auth-panel-link" disabled={loading || resendSeconds > 0} onClick={handleResend}>Resend confirmation email</button> : null}

      {successState ? (
        <div className="auth-panel-success-block" aria-live="polite">
          <div className="auth-panel-success-mark" aria-hidden="true">✓</div>
          <div className="auth-panel-success-title">{successState.title}</div>
          <p className="auth-panel-success">{successState.body}</p>
          <p className="auth-panel-copy">Look for an email from hello@reelbot.movie. If it hasn’t arrived, check your spam folder.</p>
          <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" disabled={loading || resendSeconds > 0} onClick={handleResend}>{loading ? "Sending…" : resendSeconds > 0 ? `Resend available in ${resendSeconds}s` : successState.kind === "signup" ? "Resend confirmation email" : "Send another link"}</button>
          <button
            type="button"
            className="reelbot-inline-button"
            onClick={() => {
              resetFormState();
            }}
          >
            {successState.resetLabel}
          </button>
        </div>
      ) : !user ? (
        <>
        {googleEnabled && !isForgotPasswordView ? <div className="auth-provider-options"><button type="button" className="reelbot-inline-button auth-google-button" disabled={loading || authLoading} onClick={handleGoogle}>Continue with Google</button><div className="auth-provider-divider">or use email</div></div> : null}
        <form className="auth-panel-form auth-panel-form--stacked" onSubmit={handleSubmit}>
          <input
            ref={emailInputRef}
            aria-invalid={Boolean(error)}
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
            autoComplete="email"
            required
            disabled={loading || authLoading}
          />

          {usingPasswordFlow && !isForgotPasswordView ? (
            <div className="password-input-wrap">
              <input
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                aria-invalid={Boolean(error)}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) {
                    setError("");
                  }
                }}
                placeholder="Password"
                aria-label="Password"
                autoComplete={isSignupView ? "new-password" : "current-password"}
                required
                aria-describedby={isSignupView ? "auth-password-hint" : undefined}
                disabled={loading || authLoading}
              />
              <button type="button" className="password-visibility-toggle" onPointerDown={(event) => event.preventDefault()} onClick={() => { setShowPassword((visible) => !visible); window.requestAnimationFrame(() => passwordInputRef.current?.focus({ preventScroll: true })); }} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  {showPassword ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                      <path d="M9.9 4.3A10.7 10.7 0 0 1 12 4c5.2 0 9 5 9 5a16.5 16.5 0 0 1-3.1 3.6" />
                      <path d="M6.2 6.2C4.2 7.5 3 9 3 9s3.8 5 9 5c1 0 2-.2 2.8-.5" />
                    </>
                  ) : (
                    <>
                      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          ) : null}

          {view === PASSWORD_SIGNUP_VIEW ? (
            <>
            <p id="auth-password-hint" className="auth-password-hint">Use at least 8 characters, including letters and numbers.</p>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Confirm password"
              aria-label="Confirm password"
              autoComplete="new-password"
              required
              disabled={loading || authLoading}
            />
            </>
          ) : null}

          <button type="submit" className="reelbot-inline-button reelbot-inline-button--solid" disabled={loading || authLoading}>
            {submitLabel}
          </button>
        </form>
        </>
      ) : null}

      {!user && !successState && !isForgotPasswordView ? <p className="auth-policy-note">By creating an account, you agree to our <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>. Read our <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p> : null}

      {!user ? (
        <div className="auth-panel-actions auth-panel-actions--links">
          {view === EMAIL_LINK_VIEW ? (
            <button type="button" className="auth-panel-link" onClick={() => handleViewChange(PASSWORD_LOGIN_VIEW)}>
              Back to password sign in
            </button>
          ) : view === FORGOT_PASSWORD_VIEW ? (
            <button type="button" className="auth-panel-link" onClick={() => handleViewChange(PASSWORD_LOGIN_VIEW)}>
              Back to sign in
            </button>
          ) : view === PASSWORD_LOGIN_VIEW ? (
            <>
              <button type="button" className="auth-panel-link" onClick={() => handleViewChange(FORGOT_PASSWORD_VIEW)}>
                Forgot password?
              </button>
              <button type="button" className="auth-panel-link" onClick={() => handleViewChange(EMAIL_LINK_VIEW)}>
                Email me a sign-in link
              </button>
            </>
          ) : (
            <button type="button" className="auth-panel-link" onClick={() => handleViewChange(PASSWORD_LOGIN_VIEW)}>
              Already have an account? Sign in
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default AuthPanel;
