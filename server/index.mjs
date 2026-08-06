// Node/Docker server. Retained as the rollback path for the Cloudflare Workers
// deployment (see DEPLOY_CLOUDFLARE.md) — it serves the same API surface from
// the same route registrations, backed by better-sqlite3 instead of D1.
//
// Differences from the Worker entry (worker/index.mjs):
//   - storage is a local SQLite file rather than a D1 binding
//   - static assets are served from dist/ rather than the Assets binding
//   - there is no scheduler here; the daily snapshot is a Cron Trigger on
//     Workers. Run it manually with `npm run sync` if operating on Node.

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import { registerApiRoutes } from "./api.mjs";
import { openLocalDb } from "./local-db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
// The Cloudflare Vite plugin emits the client bundle to dist/client (the worker
// build lands in dist/psx_portfolio alongside it), so the Node path serves from
// there rather than dist/ directly.
const DIST = resolve(ROOT, "dist/client");
const DATA_DIR = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : resolve(ROOT, "data");
const PORTFOLIO_DB_PATH = resolve(DATA_DIR, "portfolio.sqlite");
const STOCKS_JSON = resolve(ROOT, "public/psx-stocks.json");

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const API_TOKEN = (process.env.PSX_API_TOKEN ?? "").trim();

if (!API_TOKEN) {
  console.warn("[psx] PSX_API_TOKEN not set — /api/* is unauthenticated");
}

if (!existsSync(DIST)) {
  console.error(`[psx] dist/ not found at ${DIST}. Run "npm run build" first.`);
  process.exit(1);
}

const app = new Hono();

// Bearer-token auth on the API surface only. When no token is configured the
// API is open (warned above), matching prior behavior.
app.use("/api/*", async (c, next) => {
  if (!API_TOKEN) return next();
  const header = c.req.header("authorization") ?? "";
  if (header === `Bearer ${API_TOKEN}`) return next();
  return c.json({ error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });
});

// One connection for the process lifetime, mirroring the previous behavior.
const db = openLocalDb(PORTFOLIO_DB_PATH);

// Same static JSON the Worker serves through its Assets binding.
let stocksCache = null;
function readStocks() {
  if (stocksCache) return stocksCache;
  if (!existsSync(STOCKS_JSON)) return null;
  stocksCache = JSON.parse(readFileSync(STOCKS_JSON, "utf-8"));
  return stocksCache;
}

registerApiRoutes(app, { getDb: () => db, getStocks: () => readStocks() });

// Unmatched API paths (wrong method, bad path) → 404 JSON. Must precede the
// static/SPA handlers so an API miss never falls through to index.html.
app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

// Static assets. serve-static roots are resolved from process.cwd(), so pass a
// relative path. Long-cache the fingerprinted assets/ bundle, no-cache the rest.
const DIST_REL = relative(process.cwd(), DIST) || ".";
app.use(
  "/*",
  serveStatic({
    root: DIST_REL,
    onFound: (path, c) => {
      c.header(
        "Cache-Control",
        path.includes("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      );
    },
  }),
);

// SPA fallback: any unmatched path serves index.html.
const INDEX_HTML = join(DIST, "index.html");
app.get("/*", (c) => {
  if (existsSync(INDEX_HTML)) {
    return c.html(readFileSync(INDEX_HTML, "utf-8"));
  }
  return c.text("Not Found", 404);
});

const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
  console.log(`[psx] listening on http://${HOST}:${PORT}`);
  console.log(`[psx] data dir: ${DATA_DIR}`);
});

const shutdown = (sig) => {
  console.log(`[psx] ${sig} received, shutting down`);
  server.close(() => process.exit(0));
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
