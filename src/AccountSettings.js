import React, { useEffect, useState } from "react";
import "./App.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { buildBreadcrumbJsonLd, usePageMetadata } from "./seo";

function AccountSettings() {
  const navigate = useNavigate();
  const { user, loading, authReady, updateDisplayName, signOut, deleteAccount, authError, clearAuthError } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setDisplayName(String(user?.user_metadata?.display_name || ""));
  }, [user?.user_metadata?.display_name]);

  useEffect(() => {
    if (authReady && !user) {
      navigate("/", { replace: true });
    }
  }, [authReady, navigate, user]);

  usePageMetadata({
    title: "Account Settings | ReelBot",
    description: "Manage your ReelBot account and saved picks.",
    path: "/account",
    robots: "noindex,follow",
    structuredData: [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "Account settings", path: "/account" },
      ]),
    ],
  });

  if (!user) {
    return null;
  }

  return (
    <div className="browse-page account-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo">
          <div className="browse-copy">
            <div className="browse-kicker">Account</div>
            <h1 className="browse-title">Account settings</h1>
            <p className="browse-subtitle browse-subtitle--hero">Keep your ReelBot account light, simple, and out of the way.</p>
          </div>
        </section>

        <section className="detail-info-card account-settings-card">
          <div className="section-header section-header--stacked-mobile section-header--compact">
            <div>
              <h2 className="section-title">Your account</h2>
              <p className="section-subtitle">Your picks stay tied to this email so they travel with you.</p>
            </div>
          </div>

          <div className="account-settings-form">
            <label className="account-settings-field">
              <span>Email</span>
              <input type="email" value={user.email || ""} readOnly className="account-settings-input--readonly" />
              <small className="account-settings-note">Your sign-in email is managed through your email link.</small>
            </label>
            <label className="account-settings-field">
              <span>Display name</span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          {authError ? <p className="error-message">{authError}</p> : null}
          {successMessage ? <p className="account-settings-success">{successMessage}</p> : null}

          <div className="account-settings-actions">
            <button
              type="button"
              className="reelbot-inline-button reelbot-inline-button--solid"
              disabled={saving || loading}
              onClick={async () => {
                setSaving(true);
                setSuccessMessage("");
                clearAuthError();
                try {
                  await updateDisplayName(displayName);
                  setSuccessMessage("Saved.");
                } catch (error) {
                  console.error("Error updating ReelBot display name:", error);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Updating…" : "Update profile"}
            </button>
            <button
              type="button"
              className="reelbot-inline-button"
              disabled={loading}
              onClick={async () => {
                try {
                  await signOut();
                  navigate("/", { replace: true });
                } catch (error) {
                  console.error("Error logging out of ReelBot:", error);
                }
              }}
            >
              Log out
            </button>
          </div>
          <div className="account-settings-danger">
            <div>
              <div className="detail-description-label">Danger zone</div>
              <p className="detail-secondary-text">Delete your account and remove your saved ReelBot history.</p>
            </div>
            <button
              type="button"
              className="reelbot-inline-button reelbot-inline-button--danger"
              disabled={deleting}
              onClick={async () => {
                const confirmed = window.confirm("Delete your ReelBot account and saved picks?");
                if (!confirmed) {
                  return;
                }

                setDeleting(true);
                setSuccessMessage("");
                clearAuthError();
                try {
                  await deleteAccount();
                  navigate("/", { replace: true });
                } catch (error) {
                  console.error("Error deleting ReelBot account:", error);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Deleting…" : "Delete account"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AccountSettings;
