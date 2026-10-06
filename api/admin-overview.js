const {ownerDigest,ownerCookie}=require('../server/telemetryIdentity');
const { readProductTelemetry } = require('../server/productTelemetry');
const { buildAdminMetrics } = require("../server/adminMetrics");
const { createClient } = require("@supabase/supabase-js");
const normalizeSupabaseUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/\/(?:rest\/v1)?\/?$/, "");
const send = (res, status, payload) => {
  res.status(status);
  res.setHeader("Cache-Control", "private, no-store");
  return res.json(payload);
};
const suspended = (user) =>
  new Date(user?.banned_until || 0).getTime() > Date.now();

function createAdminHandler({ getClient, getTelemetry = readProductTelemetry } = {}) {
  return async (req, res) => {
    try {
      const url = normalizeSupabaseUrl(
        process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL,
      );
      const key =
        process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!getClient && (!url || !key))
        return send(res, 503, {
          error: "Admin server credentials are not configured.",
        });
      const authorization = String(req.headers.authorization || "");
      if (!/^Bearer\s+\S+$/i.test(authorization))
        return send(res, 401, { error: "Authenticated session required." });
      const db = getClient
        ? getClient()
        : createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
      const check = await db.auth.getUser(
        authorization.replace(/^Bearer\s+/i, ""),
      );
      const sessionUser = check.data?.user;
      if (check.error || !sessionUser)
        return send(res, 401, { error: "Authenticated session required." });
      // Read the current server-owned role. JWT metadata alone can be stale.
      const fresh = await db.auth.admin.getUserById(sessionUser.id);
      const me = fresh.data?.user;
      if (
        fresh.error ||
        !me ||
        me.app_metadata?.role !== "super_admin" ||
        suspended(me)
      ) {
        return send(res, 403, {
          error: "Super administrator access required.",
        });
      }
      if (req.method === "POST") {
        const target = String(req.body?.user_id || "");
        const action = String(req.body?.action || "");
        if (!["suspend", "restore"].includes(action))
          return send(res, 400, { error: "Unsupported admin action." });
        if (!target || target === me.id)
          return send(res, 400, {
            error: "That account cannot be modified here.",
          });
        const targetResult = await db.auth.admin.getUserById(target);
        if (targetResult.error || !targetResult.data?.user)
          return send(res, 404, { error: "Account not found." });
        if (targetResult.data.user.app_metadata?.role === "super_admin")
          return send(res, 403, {
            error: "Administrator accounts cannot be modified here.",
          });
        const result = await db.auth.admin.updateUserById(target, {
          ban_duration: action === "suspend" ? "876000h" : "none",
        });
        return result.error
          ? send(res, 400, { error: "That account could not be updated." })
          : send(res, 200, { ok: true });
      }
      if (req.method !== "GET") {
        res.setHeader("Allow", "GET, POST");
        return send(res, 405, { error: "Method not allowed." });
      }
      const cookie=ownerCookie(me.id);if(cookie)res.setHeader('Set-Cookie',cookie);
      const hideMine=String(req.query?.hide_mine||'')==='1';
      const warnings = [];
      const raw = [];
      for (let page = 1; page <= 20; page += 1) {
        const list = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (list.error) throw list.error;
        raw.push(...(list.data?.users || []));
        if ((list.data?.users || []).length < 1000) break;
        if (page === 20)
          warnings.push("The user directory is limited to 20,000 accounts.");
      }
      const read = async (label, query) => {
        try {
          const result = await query;
          if (result.error) throw result.error;
          return result;
        } catch {
          warnings.push(`${label} could not be loaded. Refresh to try again.`);
          return { data: null, count: null };
        }
      };
      const weekDate = new Date(Date.now() - 604800000).toISOString();
      const [
        moviesResult,
        sessionsResult,
        feedbackResult,
        savedResult,
        seenResult,
        feedbackCount,
        weekFeedback,
      ] = await Promise.all([
        read(
          "Per-user movie counts",
          db.from("user_movies").select("user_id,status").limit(1000),
        ),
        read(
          "Recent activity",
          db
            .from("user_sessions")
            .select("user_id,last_prompt,payload,updated_at")
            .order("updated_at", { ascending: false })
            .limit(250),
        ),
        read(
          "Recent feedback",
          db
            .from("feedback")
            .select("id,type,message,email,created_at")
            .order("created_at", { ascending: false })
            .limit(100),
        ),
        read(
          "Saved-movie total",
          db
            .from("user_movies")
            .select("id", { count: "exact", head: true })
            .or("status.eq.saved,movie_data->>saved_to_watchlist.eq.true"),
        ),
        read(
          "Seen-movie total",
          db
            .from("user_movies")
            .select("id", { count: "exact", head: true })
            .eq("status", "seen"),
        ),
        read(
          "Feedback total",
          db.from("feedback").select("id", { count: "exact", head: true }),
        ),
        read(
          "Weekly feedback",
          db
            .from("feedback")
            .select("id", { count: "exact", head: true })
            .gte("created_at", weekDate),
        ),
      ]);
      let productUsage = null;
      try { productUsage = await getTelemetry(db,Date.now(),{viewerOwner:ownerDigest(me.id),excludeOwner:hideMine?ownerDigest(me.id):null}); } catch { warnings.push("Guest and product activity could not be loaded. Refresh to try again."); }
      const movies = moviesResult.data || [];
      const countsComplete = moviesResult.data !== null && movies.length < 1000;
      if (movies.length >= 1000)
        warnings.push(
          "Per-user movie counts are unavailable above 1,000 rows; overall movie totals remain exact.",
        );
      const counts = {};
      movies.forEach((row) => {
        counts[row.user_id] = (counts[row.user_id] || 0) + 1;
      });
      const users = raw
        .map((user) => ({
          id: user.id,
          email: user.email || "",
          display_name: user.user_metadata?.display_name || "",
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          email_verified: Boolean(user.email_confirmed_at),
          banned_until: user.banned_until || null,
          is_suspended: suspended(user),
          movie_count: countsComplete ? counts[user.id] || 0 : null,
          is_admin: user.app_metadata?.role === "super_admin",
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const byId = new Map(users.map((user) => [user.id, user]));
      const visibleSessions = Array.isArray(sessionsResult.data) ? sessionsResult.data.filter(row=>!hideMine||row.user_id!==me.id) : null;
      const activity = (visibleSessions || [])
        .flatMap((row) => (Array.isArray(row.payload?.interactions) ? row.payload.interactions : [])
          .slice(0, 25)
          .map((entry, i) => ({
            id: `${row.user_id}-${i}`,
            user_id: row.user_id,
            email: byId.get(row.user_id)?.email || "",
            label: entry.type === "request_result"
              ? ({ pick: "Recommendation returned", no_match: "No matching movie", failed: "Recommendation failed", fallback: "Recommendation recovered" }[entry.metadata?.outcome] || "Recommendation request")
              : ({ pick_shown: "Movie recommended", save: "Movie saved", seen: "Marked watched", hidden: "Marked not for me", unsave: "Removed from saved", unsee: "Removed from watched" }[entry.type] || String(entry.type || "Activity").replaceAll("_", " ")),
            detail: entry.movie?.title || entry.metadata?.prompt || (entry.type === "request_result" ? entry.metadata?.surface || "" : ""),
            created_at: entry.timestamp || row.updated_at,
          })))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return send(res, 200, {
        stats: {
          total_users: users.length,
          verified_users: users.filter(user => user.email_verified).length,
          pending_verification: users.filter(user => !user.email_verified).length,
          new_users_7d: users.filter((user) => user.created_at >= weekDate)
            .length,
          active_users_7d: users.filter(
            (user) => user.last_sign_in_at >= weekDate,
          ).length,
          saved_movies: savedResult.count,
          seen_movies: seenResult.count,
          feedback_count: feedbackCount.count,
          feedback_7d: weekFeedback.count,
        },
        operations: buildAdminMetrics(visibleSessions),
        product_usage: productUsage,
        activity_filter: {hide_mine:hideMine},
        users,
        activity: activity.slice(0, 200),
        feedback: feedbackResult.data || [],
        warnings,
        limits: { activity: 200, profiles: 250, feedback: 100 },
      });
    } catch (error) {
      console.error("Admin overview failed:", error?.message);
      return send(res, 503, {
        error: "Admin data is temporarily unavailable. Please try again.",
      });
    }
  };
}
module.exports = createAdminHandler();
module.exports.createAdminHandler = createAdminHandler;
