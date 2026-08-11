// Cloudflare Worker entry point. Replaces server/index.mjs (Node + Hono +
// serve-static + setTimeout scheduler).
//
// Static assets and the SPA fallback are handled declaratively by the Assets
// binding configured in wrangler.jsonc, so there is no static-file code here —
// only the API surface and the scheduled handler.

import { Hono } from "hono";
import { registerApiRoutes } from "../server/api.mjs";
import { runDailySync } from "../server/cron.mjs";
import { d1Adapter } from "../server/db-adapter.mjs";
import {
  checkThrottle,
  clearCookie,
  clearFailures,
  createSession,
  readCookie,
  recordFailure,
  sessionCookie,
  verifyPassword,
  verifySession,
} from "./auth.mjs";

const app = new Hono();

const clientIp = (c) => c.req.header("cf-connecting-ip") ?? "unknown";

/* ---------------- auth routes (must precede the /api/* gate) ------------- */

app.post("/api/auth/login", async (c) => {
  const secret = c.env.SESSION_SECRET;
  const stored = c.env.APP_PASSWORD_HASH;
  if (!secret || !stored) {
    console.error("[psx:auth] SESSION_SECRET or APP_PASSWORD_HASH not configured");
    return c.json({ error: "auth not configured" }, 503);
  }

  const db = d1Adapter(c.env.DB);
  const ip = clientIp(c);

  const throttle = await checkThrottle(db, ip);
  if (throttle.locked) {
    const retryAfter = Math.ceil(throttle.retryAfterMs / 1000);
    return c.json({ error: "too many attempts" }, 429, {
      "Retry-After": String(retryAfter),
    });
  }

  let password = "";
  try {
    password = (await c.req.json())?.password ?? "";
  } catch {
    /* malformed body is just a failed attempt */
  }

  let ok = false;
  try {
    ok = Boolean(password) && (await verifyPassword(password, stored));
  } catch (err) {
    // Derivation failed (e.g. CPU limit). This is an outage, not a bad
    // password — report it as such so it cannot masquerade as a login failure,
    // and do not count it against the caller's throttle.
    console.error("[psx:auth] password verification failed to run:", err);
    return c.json({ error: "auth temporarily unavailable" }, 503);
  }

  if (!ok) {
    const { lockedUntil } = await recordFailure(db, ip, throttle.row);
    // Deliberately uniform message — never reveal whether the account exists,
    // how many attempts remain, or how close the password was.
    return c.json(
      { error: "invalid password", ...(lockedUntil ? { lockedUntil } : {}) },
      401,
    );
  }

  await clearFailures(db, ip);
  const token = await createSession(secret);
  return c.json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token) });
});

app.post("/api/auth/logout", (c) =>
  c.json({ ok: true }, 200, { "Set-Cookie": clearCookie() }),
);

// Cheap probe the SPA uses on boot to decide whether to show the login screen.
app.get("/api/auth/me", async (c) => {
  const token = readCookie(c.req.header("cookie"));
  const session = c.env.SESSION_SECRET
    ? await verifySession(token, c.env.SESSION_SECRET)
    : null;
  return session
    ? c.json({ authenticated: true, exp: session.exp })
    : c.json({ authenticated: false }, 401);
});

/* ---------------- session gate on the rest of the API -------------------- */

app.use("/api/*", async (c, next) => {
  const secret = c.env.SESSION_SECRET;

  // Fail closed. An unconfigured secret must not mean an open API — that is
  // exactly the failure mode the old baked-token gate had.
  if (!secret) {
    console.error("[psx:auth] SESSION_SECRET not set — refusing all API access");
    return c.json({ error: "auth not configured" }, 503);
  }

  const session = await verifySession(readCookie(c.req.header("cookie")), secret);
  if (!session) return c.json({ error: "unauthorized" }, 401);
  return next();
});

/* ---------------- application routes ------------------------------------ */

// The reference stock list is a static asset rather than a database — it is
// ~57 KB of never-changing data. Fetched through the Assets binding so the
// /api/psx/stocks contract is unchanged for the frontend.
async function getStocks(c) {
  const res = await c.env.ASSETS.fetch(new URL("/psx-stocks.json", c.req.url));
  if (!res.ok) return null;
  return res.json();
}

registerApiRoutes(app, {
  getDb: (c) => d1Adapter(c.env.DB),
  getStocks,
});

/**
 * Persist the outcome of a sync attempt.
 *
 * Written for both scheduled and manual runs, including the ones that decline
 * to snapshot. Without this a skipped night is indistinguishable from a crashed
 * one after Cloudflare's log window closes.
 */
async function recordRun(db, res, error) {
  try {
    await db.run(
      `INSERT INTO cron_runs
         (ran_at, pk_date, ran, reason, rule, quotes, tickers, sources, kse_source, error, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        new Date().toISOString(),
        res?.pkDate ?? null,
        res?.ran ? 1 : 0,
        res?.reason ?? null,
        res?.freshnessRule ?? null,
        res?.quoteCount ?? null,
        res?.tickers ?? null,
        res?.sources ?? null,
        res?.kseSource ?? null,
        error ? String(error?.stack ?? error).slice(0, 2000) : null,
        res?.durationMs ?? null,
      ],
    );
  } catch (err) {
    // Never let bookkeeping mask the run it is describing.
    console.error("[psx:cron] failed to record run:", err);
  }
}

// Manual trigger + audit read, both session-gated by the middleware above.
//
// ?dry=1 runs the full decision without writing, which is the only way to see
// what the nightly job would do without waiting for 23:59 PKT.
app.post("/api/admin/sync", async (c) => {
  const db = d1Adapter(c.env.DB);
  const dryRun = c.req.query("dry") != null;
  const force = c.req.query("force") != null;
  try {
    const res = await runDailySync({ db, dryRun, force });
    await recordRun(db, res, null);
    return c.json(res);
  } catch (err) {
    await recordRun(db, null, err);
    return c.json({ error: String(err?.message ?? err) }, 500);
  }
});

app.get("/api/admin/runs", async (c) => {
  const rows = await d1Adapter(c.env.DB).all(
    "SELECT * FROM cron_runs ORDER BY id DESC LIMIT 20",
  );
  return c.json(rows);
});

// Unmatched API paths (wrong method, bad path) → 404 JSON. Must precede the
// asset handler so an API miss never falls through to index.html.
app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

// Anything not matched above is a static asset or an SPA route. The Assets
// binding is configured with not_found_handling: "single-page-application",
// so unknown paths return index.html and client-side routing takes over.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,

  // Cron Trigger: "59 18 * * *" UTC = 23:59 PKT (UTC+5, no DST). Scheduled
  // invocations do not pass through the HTTP gate above, so the session
  // requirement does not affect the nightly snapshot.
  async scheduled(controller, env, ctx) {
    const db = d1Adapter(env.DB);
    ctx.waitUntil(
      runDailySync({ db })
        .then((res) => recordRun(db, res, null))
        .catch(async (err) => {
          console.error("[psx:cron] run failed:", err);
          await recordRun(db, null, err);
        }),
    );
  },
};
