import http from "http";
import { createReadStream, statSync, existsSync } from "fs";
import { resolve, dirname, join, extname, normalize } from "path";
import { fileURLToPath } from "url";
import { createApiMiddleware } from "./api.mjs";
import { runDailySync, startScheduler } from "./cron.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");
const DATA_DIR = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : resolve(ROOT, "data");
const DB_PATH = resolve(DATA_DIR, "psx-stocks.db");
const PORTFOLIO_PATH = resolve(DATA_DIR, "portfolio.json");

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const API_TOKEN = (process.env.PSX_API_TOKEN ?? "").trim();

if (!API_TOKEN) {
  console.warn("[psx] PSX_API_TOKEN not set — /api/* is unauthenticated");
}

function checkAuth(req, res) {
  if (!API_TOKEN) return true;
  const header = req.headers["authorization"] ?? "";
  const expected = `Bearer ${API_TOKEN}`;
  if (header === expected) return true;
  res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" });
  res.end(JSON.stringify({ error: "unauthorized" }));
  return false;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

const api = createApiMiddleware({
  dbPath: DB_PATH,
  portfolioPath: PORTFOLIO_PATH,
});

function serveFile(res, filePath, status = 200) {
  const ext = extname(filePath).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";
  const isImmutable = filePath.includes(`${DIST}/assets/`) || filePath.includes(`${DIST}\\assets\\`);
  const cache = isImmutable
    ? "public, max-age=31536000, immutable"
    : "no-cache";
  res.writeHead(status, { "Content-Type": type, "Cache-Control": cache });
  createReadStream(filePath).pipe(res);
}

function serveStatic(req, res) {
  const url = (req.url ?? "/").split("?")[0];
  const safe = normalize(decodeURIComponent(url)).replace(/^([/\\])+/, "");
  const candidate = join(DIST, safe);

  if (!candidate.startsWith(DIST)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (existsSync(candidate)) {
    const st = statSync(candidate);
    if (st.isFile()) return serveFile(res, candidate);
  }

  // SPA fallback
  const indexHtml = join(DIST, "index.html");
  if (existsSync(indexHtml)) return serveFile(res, indexHtml);

  res.writeHead(404);
  res.end("Not Found");
}

if (!existsSync(DIST)) {
  console.error(`[psx] dist/ not found at ${DIST}. Run "npm run build" first.`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if ((req.url ?? "").startsWith("/api/")) {
    if (!checkAuth(req, res)) return;
    return api(req, res, () => serveStatic(req, res));
  }
  serveStatic(req, res);
});

let stopScheduler = () => {};

server.listen(PORT, HOST, () => {
  console.log(`[psx] listening on http://${HOST}:${PORT}`);
  console.log(`[psx] data dir: ${DATA_DIR}`);

  if (process.env.CRON_DISABLED) {
    console.log("[psx:cron] disabled via CRON_DISABLED");
  } else {
    if (process.env.CRON_RUN_ON_BOOT) {
      console.log("[psx:cron] CRON_RUN_ON_BOOT=1 — forcing immediate sync");
      runDailySync({ portfolioPath: PORTFOLIO_PATH, force: true }).catch((err) =>
        console.error("[psx:cron] forced run failed:", err),
      );
    }
    stopScheduler = startScheduler({ portfolioPath: PORTFOLIO_PATH });
  }
});

const shutdown = (sig) => {
  console.log(`[psx] ${sig} received, shutting down`);
  stopScheduler();
  server.close(() => process.exit(0));
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
