import AdminRequestLog from "./components/AdminRequestLog";
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
  const [hideMine,setHideMine]=useState(()=>{try{return localStorage.getItem('reelbot:admin-hide-mine')!=='false';}catch{return true;}});
  useEffect(()=>{try{localStorage.setItem('reelbot:admin-hide-mine',String(hideMine));}catch{}},[hideMine]);
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
      const r = await fetch(`/api/admin-overview?hide_mine=${hideMine ? 1 : 0}`, {
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
  }, [getFreshToken,hideMine]);
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
  const ops = data?.operations;
  const usage = data?.product_usage;
  const seconds = ms => ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`;
  return (
    <div className="admin-page">
      <div className="admin-shell">
        <header className="admin-heading">
          <div>
            <span className="admin-eyebrow">REELBOT / ADMIN</span>
            <h1>Admin console</h1>
            <p>Users, product activity and account health in one place.</p>
          </div>
          <label className="admin-hide-mine"><input type="checkbox" checked={hideMine} onChange={event=>setHideMine(event.target.checked)} /> Hide my activity</label>
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
                <small>{s.verified_users ?? "—"} verified · {s.pending_verification ?? "—"} awaiting verification</small>
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
            <section className="admin-card admin-card--full rb-product-usage" aria-labelledby="product-usage-title">
              <div className="admin-card-head"><div><span className="admin-kicker">Guests & accounts</span><h2 id="product-usage-title">Are people finding a movie?</h2></div><span className="rb-ops-scope">{usage?.scope || "Activity unavailable"}</span></div>
              {usage ? <><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Observed activity</th><th>Guests</th><th>Signed in</th><th>All sessions</th></tr></thead><tbody>{[
                ["Sessions", "sessions"], ["Page views", "page_views"], ["Completed recommendation requests", "completed"], ["Picks returned", "picks"], ["No match", "no_match"], ["Request failures", "failed"], ["Movie identifications (separate)", "identifications"], ["Movies presented", "presented"], ["Chosen to watch", "chosen"], ["Details opened after a pick", "details"], ["Saved after a pick", "saved"], ["Marked watched after a pick", "watched"], ["Save sign-in attempts", "save_attempts"], ["Another pick clicks", "swaps"], ["Refinements", "refinements"], ["Shares", "shares"]
              ].map(([label,key])=><tr key={key}><td>{label}</td><td>{usage.guests[key]}</td><td>{usage.signed_in[key]}</td><td>{usage.total[key]}</td></tr>)}<tr><td>Median response</td><td>{seconds(usage.guests.median_ms)}</td><td>{seconds(usage.signed_in.median_ms)}</td><td>{seconds(usage.total.median_ms)}</td></tr><tr><td>95th percentile response</td><td>{seconds(usage.guests.p95_ms)}</td><td>{seconds(usage.signed_in.p95_ms)}</td><td>{seconds(usage.total.p95_ms)}</td></tr></tbody></table></div>{usage.surfaces?.length ? <details className="rb-ops-coverage"><summary>Where visitors spend time</summary><ul>{usage.surfaces.map(row=><li key={row.page}>{row.page.replaceAll("_", " ")}: {row.views} page views · {row.guest_sessions} guest sessions</li>)}</ul></details> : null}<p className="rb-ops-note">Chosen means an explicit intention to watch. Saves and Watched are separate actions. Later actions count only when the same session first saw that movie as a pick; they are not proof the movie was played.</p><details className="rb-ops-coverage"><summary>Coverage and limitations</summary><p>{usage.coverage}</p></details></> : <p className="rb-ops-note">Guest usage starts with this release. Missing activity will appear as unavailable, rather than a zero.</p>}
            </section>
            <section className="rb-operations" aria-labelledby="operations-title">
              <div className="admin-card-head"><div><span className="admin-kicker">Recommendation health</span><h2 id="operations-title">From a pick to movie night</h2></div><span className="rb-ops-scope">{ops?.scope || "Activity sample unavailable"}</span></div>
              {ops ? <>
                <div className="rb-ops-metrics">
                  <div><span>Completed requests</span><strong>{ops.requests.total}</strong><small>{ops.requests.pick} picks · {ops.requests.no_match} no matches</small></div>
                  <div><span>Median response</span><strong>{seconds(ops.requests.median_ms)}</strong><small>95th percentile {seconds(ops.requests.p95_ms)}</small></div>
                  <div><span>Request failures</span><strong>{ops.requests.failure_rate == null ? "—" : `${Math.round(ops.requests.failure_rate * 100)}%`}</strong><small>{ops.requests.failed} failed · {ops.requests.fallback} recovered</small></div>
                </div>
                {!ops.requests.total ? <p className="rb-ops-note">Timing starts with requests made after this release. No measured requests are in the retained sample yet.</p> : null}
                <div className="rb-funnel" aria-label="Observed pick to saved to watched cohort">
                  <div><strong>{ops.funnel.picked}</strong><span>Movies picked</span></div><span aria-hidden="true">→</span><div><strong>{ops.funnel.saved}</strong><span>Then saved</span></div><span aria-hidden="true">→</span><div><strong>{ops.funnel.watched}</strong><span>Then watched</span></div>
                </div>
                <p className="rb-ops-note">Unique user/movie pairs, with each later step observed in order. This shows historical actions, not current library totals.</p>
                <details className="rb-ops-coverage"><summary>What this sample includes</summary><p>{ops.coverage} Response time covers the interactive request until a usable response or error reaches the browser; it excludes cached queue promotions.</p></details>
                {ops.recent_failures.length ? <div className="rb-ops-failures"><h3>Recent interruptions</h3>{ops.recent_failures.map((item,index) => <p key={index}><span>{item.surface} · {item.outcome}</span><time dateTime={item.created_at}>{fmt(item.created_at)}</time></p>)}</div> : null}
              </> : <p className="rb-ops-note">Request health will appear when retained profile activity can be read.</p>}
            </section>
            <div className="admin-grid">
              <section className="admin-card">
                <div className="admin-card-head">
                  <div>
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
                            (x.is_suspended ? "is-banned" : x.email_verified ? "is-active" : "is-pending")
                          }
                        >
                          {x.is_suspended ? "Suspended" : x.email_verified ? "Verified" : "Awaiting verification"}
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
        {data && tab === "activity" ? <AdminRequestLog rows={usage?.request_log || []} /> : null}
        {data && tab === "activity" ? (
          <section className="admin-card admin-card--full">
            <div className="admin-card-head">
              <div>
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
