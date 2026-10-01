import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { getSupabaseClient } from "./lib/supabaseClient";
import { usePageMetadata } from "./seo";
import { formatAdminDate as fmt, adminTimeAgo as ago } from "./adminTime";
import "./App.css";
export default function AdminPanel() {
  const { user, authReady } = useAuth();
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState("overview"),
    [busy, setBusy] = useState("");
  usePageMetadata({
    title: "Admin console | ReelBot",
    description: "Private ReelBot administration console.",
    path: "/admin",
    robots: "noindex,nofollow",
  });
  const requestRef = useRef(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const getFreshToken = useCallback(async () => {
    const client = await getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    let current = data?.session;
    if (!current?.access_token)
      throw new Error("Authenticated session required.");
    const expiresAt = Number(current.expires_at || 0) * 1000;
    if (expiresAt && expiresAt - Date.now() < 60000) {
      const refreshed = await client.auth.refreshSession();
      if (refreshed.error) throw refreshed.error;
      current = refreshed.data?.session;
    }
    if (!current?.access_token)
      throw new Error("Authenticated session required.");
    return current.access_token;
  }, []);
  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const token = await getFreshToken();
      const r = await fetch("/api/admin-overview", {
        signal: controller.signal,
        headers: { Authorization: "Bearer " + token },
      });
      const p = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(p.error || "Could not load admin data.");
      if (!controller.signal.aborted) setData(p);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e.message || "Could not load admin data.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [getFreshToken]);
  useEffect(() => {
    setData(null);
    if (user?.app_metadata?.role === "super_admin") load();
    return () => requestRef.current?.abort();
  }, [load, user?.id, user?.app_metadata?.role]);
  const setAccountState = async (target, action) => {
    if (busy) return;
    setBusy(target + action);
    setError("");
    try {
      const token = await getFreshToken();
      const r = await fetch("/api/admin-overview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ user_id: target, action }),
      });
      const p = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(p.error || "Could not update account.");
      await load();
    } catch (e) {
      setError(e.message || "Could not update account.");
    } finally {
      setBusy("");
    }
  };
  const users = useMemo(() => {
    const n = query.trim().toLowerCase(),
      rows = data?.users || [];
    return n
      ? rows.filter((x) =>
          [x.email, x.id, x.display_name].some((v) =>
            String(v || "")
              .toLowerCase()
              .includes(n),
          ),
        )
      : rows;
  }, [data?.users, query]);
  if (!authReady) return <div className="admin-loading">Checking access…</div>;
  if (!user || user?.app_metadata?.role !== "super_admin")
    return <Navigate to="/" replace />;
  const s = data?.stats || {};
  return (
    <div className="admin-page">
      <div className="admin-shell">
        <header className="admin-heading">
          <div>
            <span className="admin-eyebrow">REELBOT / ADMIN</span>
            <h1>Admin console</h1>
            <p>Users, product activity and account health in one place.</p>
          </div>
          <button className="admin-refresh" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh data"}
          </button>
        </header>
        {error ? (
          <div className="admin-alert" role="alert">
            <strong>Admin data unavailable</strong>
            <span>{error}</span>
          </div>
        ) : null}
        {data?.warnings?.length ? (
          <div className="admin-alert" role="status">
            <strong>Some data is unavailable</strong>
            {data.warnings.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
        ) : null}
        <nav className="admin-tabs" aria-label="Admin sections">
          {["overview", "users", "activity", "feedback"].map((x) => (
            <button
              type="button"
              key={x}
              aria-current={tab === x ? "page" : undefined}
              className={tab === x ? "is-active" : ""}
              onClick={() => setTab(x)}
            >
              {x}
            </button>
          ))}
        </nav>
        {loading && !data ? (
          <div className="admin-loading">Loading admin data…</div>
        ) : null}
        {data && tab === "overview" ? (
          <>
            <section className="admin-stat-grid">
              <article>
                <span>Total users</span>
                <strong>{s.total_users ?? "—"}</strong>
                <small>{s.new_users_7d ?? "—"} joined in 7 days</small>
              </article>
              <article>
                <span>Recent sign-ins</span>
                <strong>{s.active_users_7d ?? "—"}</strong>
                <small>Signed in within 7 days</small>
              </article>
              <article>
                <span>Saved movies</span>
                <strong>{s.saved_movies ?? "—"}</strong>
                <small>{s.seen_movies ?? "—"} marked seen</small>
              </article>
              <article>
                <span>Feedback</span>
                <strong>{s.feedback_count ?? "—"}</strong>
                <small>{s.feedback_7d ?? "—"} received in 7 days</small>
              </article>
            </section>
            <div className="admin-grid">
              <section className="admin-card">
                <div className="admin-card-head">
                  <div>
                    <span className="admin-kicker">Account pulse</span>
                    <h2>Recent users</h2>
                  </div>
                  <button onClick={() => setTab("users")}>View all</button>
                </div>
                {(data.users || []).slice(0, 8).map((x) => (
                  <div className="admin-list-row" key={x.id}>
                    <span className="admin-avatar">
                      {(x.email || "?")[0].toUpperCase()}
                    </span>
                    <div>
                      <strong>{x.display_name || x.email}</strong>
                      <small>{x.email}</small>
                    </div>
                    <time dateTime={x.last_sign_in_at} title={fmt(x.last_sign_in_at)}>{ago(x.last_sign_in_at)}</time>
                  </div>
                ))}
              </section>
              <section className="admin-card">
                <div className="admin-card-head">
                  <div>
                    <span className="admin-kicker">Product pulse</span>
                    <h2>Latest activity</h2>
                  </div>
                  <button onClick={() => setTab("activity")}>View all</button>
                </div>
                {(data.activity || []).slice(0, 10).map((x, i) => (
                  <div
                    className="admin-list-row admin-list-row--activity"
                    key={x.id || i}
                  >
                    <span className="admin-event-dot" />
                    <div>
                      <strong>{x.label}</strong>
                      <small>{x.detail || x.email}</small>
                    </div>
                    <time dateTime={x.created_at} title={fmt(x.created_at)}>{ago(x.created_at)}</time>
                  </div>
                ))}
              </section>
            </div>
          </>
        ) : null}
        {data && tab === "users" ? (
          <section className="admin-card admin-card--full">
            <div className="admin-card-head admin-card-head--users">
              <div>
                <span className="admin-kicker">Directory</span>
                <h2>Users</h2>
              </div>
              <input
                className="admin-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search users"
                placeholder="Search email, name or UID"
              />
            </div>
            <div className="admin-table-wrap" role="region" aria-label="User directory" tabIndex={0}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Created</th>
                    <th>Last sign in</th>
                    <th>Movies</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!users.length ? (
                    <tr>
                      <td colSpan="6">No users match this search.</td>
                    </tr>
                  ) : null}
                  {users.map((x) => (
                    <tr key={x.id}>
                      <td>
                        <strong>{x.display_name || x.email}</strong>
                        <small>{x.email}</small>
                        <code>{x.id}</code>
                      </td>
                      <td>{fmt(x.created_at)}</td>
                      <td>{fmt(x.last_sign_in_at)}</td>
                      <td>{x.movie_count ?? "—"}</td>
                      <td>
                        <span
                          className={
                            "admin-status " +
                            (x.is_suspended ? "is-banned" : "is-active")
                          }
                        >
                          {x.is_suspended ? "Suspended" : "Active"}
                        </span>
                      </td>
                      <td>
                        {x.is_admin ? (
                          <span className="admin-owner-badge">Super admin</span>
                        ) : (
                          <button
                            className="admin-user-action"
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              setAccountState(
                                x.id,
                                x.is_suspended ? "restore" : "suspend",
                              )
                            }
                          >
                            {x.is_suspended ? "Restore" : "Suspend"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        {data && tab === "activity" ? (
          <section className="admin-card admin-card--full">
            <div className="admin-card-head">
              <div>
                <span className="admin-kicker">Event stream</span>
                <h2>Recent activity</h2>
              </div>
            </div>
            <p className="detail-secondary-text">
              Up to 200 recent events from 250 synced profiles. Sign-ins and
              guest browsing are not a complete usage measure.
            </p>
            <div className="admin-activity-feed">
              {!data.activity?.length ? (
                <p>No recent synced activity.</p>
              ) : null}
              {(data.activity || []).map((x, i) => (
                <article key={x.id || i}>
                  <span className="admin-event-dot" />
                  <div>
                    <strong>{x.label}</strong>
                    <p>{x.detail || "ReelBot activity"}</p>
                    <small>{x.email || x.user_id}</small>
                  </div>
                  <time dateTime={x.created_at}>{fmt(x.created_at)}</time>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {data && tab === "feedback" ? (
          <section className="admin-card admin-card--full">
            <div className="admin-card-head">
              <div>
                <span className="admin-kicker">Inbox</span>
                <h2>User feedback</h2>
              </div>
            </div>
            <p className="detail-secondary-text">
              Latest 100 messages. Totals on Overview include all feedback.
            </p>
            <div className="admin-feedback-grid">
              {(data.feedback || []).length ? (
                (data.feedback || []).map((x, i) => (
                  <article key={x.id || i}>
                    <div>
                      <span className="admin-feedback-type">
                        {x.type || "feedback"}
                      </span>
                      <time dateTime={x.created_at}>{fmt(x.created_at)}</time>
                    </div>
                    <p>{x.message}</p>
                    <small>{x.email || "No reply email"}</small>
                  </article>
                ))
              ) : (
                <div className="admin-empty">No feedback yet.</div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
