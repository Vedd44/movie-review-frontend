const test = require("node:test");
const assert = require("node:assert/strict");
const { createAdminHandler } = require("../api/admin-overview");
function fixture({
  role = "super_admin",
  targetRole = "",
  queryError = false,
  bannedUntil,
} = {}) {
  let mutations = 0,
    reads = 0;
  const db = {
    auth: {
      getUser: async () => ({ data: { user: { id: "owner" } } }),
      admin: {
        getUserById: async (id) => ({
          data: {
            user: {
              id,
              app_metadata: { role: id === "owner" ? role : targetRole },
              banned_until: id === "owner" ? bannedUntil : null,
            },
          },
        }),
        updateUserById: async () => {
          mutations++;
          return {};
        },
        listUsers: async () => ({ data: { users: [] } }),
      },
    },
    from: () => {
      reads++;
      const q = {
        select: () => q,
        eq: () => q,
        or: () => q,
        gte: () => q,
        limit: () => q,
        order: () => q,
        then: (resolve) =>
          resolve(
            queryError
              ? { error: new Error("unavailable") }
              : { data: [], count: 5 },
          ),
      };
      return q;
    },
  };
  const handler = createAdminHandler({ getClient: () => db });
  return {
    run: async (method, body = {}, auth = "Bearer valid") => {
      const res = {
        status(n) {
          this.code = n;
          return this;
        },
        setHeader(k, v) {
          this[k] = v;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };
      await handler({ method, headers: { authorization: auth }, body }, res);
      return res;
    },
    mutations: () => mutations,
    reads: () => reads,
  };
}
test("requires authentication and a fresh server-owned role before reading data", async () => {
  const missing = fixture();
  assert.equal((await missing.run("GET", {}, "")).code, 401);
  assert.equal(missing.reads(), 0);
  const revoked = fixture({ role: "member" });
  assert.equal((await revoked.run("GET")).code, 403);
  assert.equal(revoked.reads(), 0);
  const banned = fixture({ bannedUntil: "2099-01-01" });
  assert.equal((await banned.run("GET")).code, 403);
});
test("protects both the current administrator and other administrator accounts", async () => {
  const f = fixture({ targetRole: "super_admin" });
  assert.equal(
    (await f.run("POST", { user_id: "owner", action: "suspend" })).code,
    400,
  );
  assert.equal(
    (await f.run("POST", { user_id: "other", action: "suspend" })).code,
    403,
  );
  assert.equal(f.mutations(), 0);
});
test("data-source failures produce warnings and unavailable counts, never healthy zeroes", async () => {
  const r = await fixture({ queryError: true }).run("GET");
  assert.equal(r.code, 200);
  assert.ok(r.body.warnings.length);
  assert.equal(r.body.stats.saved_movies, null);
  assert.equal(r["Cache-Control"], "private, no-store");
});
test("read-only overview uses exact aggregate totals", async () => {
  const f = fixture();
  const r = await f.run("GET");
  assert.equal(r.body.stats.feedback_count, 5);
  assert.equal(f.mutations(), 0);
});
