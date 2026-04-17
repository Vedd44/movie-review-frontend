import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { validatePassword } from "./authValidation";
import { buildBreadcrumbJsonLd, usePageMetadata } from "./seo";

function ResetPassword() {
  const navigate = useNavigate();
  const {
    user,
    authReady,
    loading: authLoading,
    passwordRecoveryActive,
    updatePassword,
    clearPasswordRecovery,
    authError,
    clearAuthError,
  } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  usePageMetadata({
    title: "Reset Password | ReelBot",
    description: "Choose a new password for your ReelBot account.",
    path: "/reset-password",
    robots: "noindex,follow",
    structuredData: [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Reset password", path: "/reset-password" },
      ]),
    ],
  });

  useEffect(() => {
    return () => {
      clearPasswordRecovery();
    };
  }, [clearPasswordRecovery]);

  const canResetPassword = Boolean(user) || passwordRecoveryActive;

  const handleSubmit = async (event) => {
    event.preventDefault();

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords need to match");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    clearAuthError();

    try {
      await updatePassword(password);
      setSuccess("Password updated. Taking you back to your account.");
      clearPasswordRecovery();
      window.setTimeout(() => {
        navigate("/account", { replace: true });
      }, 1200);
    } catch (submitError) {
      console.error("Error resetting ReelBot password:", submitError);
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="browse-page account-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo">
          <div className="browse-copy">
            <div className="browse-kicker">Account</div>
            <h1 className="browse-title">Reset your password</h1>
            <p className="browse-subtitle browse-subtitle--hero">Set a new password, then return to your account.</p>
          </div>
        </section>

        <section className="detail-info-card account-settings-card account-settings-card--narrow">
          {!authReady || authLoading ? (
            <p className="account-settings-note">Checking your reset link.</p>
          ) : canResetPassword ? (
            <>
              <div className="section-header section-header--stacked-mobile section-header--compact">
                <div>
                  <h2 className="section-title">New password</h2>
                  <p className="section-subtitle">Use at least 8 characters with letters and numbers.</p>
                </div>
              </div>

              <form className="account-settings-stack" onSubmit={handleSubmit}>
                <label className="account-settings-field">
                  <span>New password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (error) {
                        setError("");
                      }
                    }}
                    placeholder="New password"
                    autoFocus
                  />
                </label>
                <label className="account-settings-field">
                  <span>Confirm password</span>
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
                  />
                </label>

                {error ? <p className="error-message auth-panel-error">{error}</p> : null}
                {authError ? <p className="error-message auth-panel-error">{authError}</p> : null}
                {success ? <p className="account-settings-success">{success}</p> : null}

                <div className="account-settings-actions">
                  <button
                    type="submit"
                    className="reelbot-inline-button reelbot-inline-button--solid"
                    disabled={loading}
                  >
                    {loading ? "Updating…" : "Update password"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="account-settings-stack">
              <p className="account-settings-note">Open the reset link from your email to set a new password.</p>
              <div className="account-settings-actions">
                <Link to="/" className="reelbot-inline-button">
                  Back home
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default ResetPassword;
