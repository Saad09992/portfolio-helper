import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, join, relative } from "path";
import { fileURLToPath } from "url";
import { registerApiRoutes } from "./api.mjs";
import { runDailySync, startScheduler } from "./cron.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");
const DATA_DIR = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : resolve(ROOT, "data");
const DB_PATH = resolve(DATA_DIR, "psx-stocks.db");
const PORTFOLIO_DB_PATH = resolve(DATA_DIR, "portfolio.sqlite");

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

registerApiRoutes(app, { dbPath: DB_PATH, portfolioDbPath: PORTFOLIO_DB_PATH });

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

let stopScheduler = () => {};

const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
  console.log(`[psx] listening on http://${HOST}:${PORT}`);
  console.log(`[psx] data dir: ${DATA_DIR}`);

  if (process.env.CRON_DISABLED) {
    console.log("[psx:cron] disabled via CRON_DISABLED");
  } else {
    if (process.env.CRON_RUN_ON_BOOT) {
      console.log("[psx:cron] CRON_RUN_ON_BOOT=1 — forcing immediate sync");
      runDailySync({ portfolioDbPath: PORTFOLIO_DB_PATH, force: true }).catch((err) =>
        console.error("[psx:cron] forced run failed:", err),
      );
    }
    stopScheduler = startScheduler({ portfolioDbPath: PORTFOLIO_DB_PATH });
  }
});

const shutdown = (sig) => {
  console.log(`[psx] ${sig} received, shutting down`);
  stopScheduler();
  server.close(() => process.exit(0));
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
