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

const app = new Hono();

// Bearer-token auth on the API surface only. When no token is configured the
// API is open, matching prior behavior.
//
// NOTE: this is the pre-existing build-time-baked token (see AUTH.md) and it is
// readable by anyone who loads the page. It is retained only to keep the
// deployment behaviour identical during migration; it is replaced by the cookie
// session gate as the final step.
app.use("/api/*", async (c, next) => {
  const token = (c.env.PSX_API_TOKEN ?? "").trim();
  if (!token) return next();
  const header = c.req.header("authorization") ?? "";
  if (header === `Bearer ${token}`) return next();
  return c.json({ error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
});

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

// Unmatched API paths (wrong method, bad path) → 404 JSON. Must precede the
// asset handler so an API miss never falls through to index.html.
app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

// Anything not matched above is a static asset or an SPA route. The Assets
// binding is configured with not_found_handling: "single-page-application",
// so unknown paths return index.html and client-side routing takes over.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,

  // Cron Trigger: "59 18 * * *" UTC = 23:59 PKT (UTC+5, no DST).
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      runDailySync({ db: d1Adapter(env.DB) }).catch((err) =>
        console.error("[psx:cron] run failed:", err),
      ),
    );
  },
};
