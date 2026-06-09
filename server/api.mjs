import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { copyFile, readFile, rename, rm, writeFile } from "fs/promises";
import { dirname } from "path";

const BACKUP_GENERATIONS = 5;

async function rotateBackups(portfolioPath) {
  if (!existsSync(portfolioPath)) return;
  // Drop the oldest, shift the rest down, copy current → .bak.1
  for (let i = BACKUP_GENERATIONS; i >= 1; i--) {
    const src = i === 1 ? portfolioPath : `${portfolioPath}.bak.${i - 1}`;
    const dst = `${portfolioPath}.bak.${i}`;
    if (i === BACKUP_GENERATIONS) {
      // Drop oldest; ignore if it doesn't exist
      await rm(dst, { force: true });
    }
    if (i === 1 || existsSync(src)) {
      await copyFile(src, dst).catch((err) => {
        console.warn(`[psx] backup rotate ${src} -> ${dst} failed:`, err.message);
      });
    }
  }
}

let saveQueue = Promise.resolve();
export function serializeSave(work) {
  const next = saveQueue.then(work, work);
  // Swallow errors on the queue so one failure does not block subsequent saves
  saveQueue = next.catch(() => undefined);
  return next;
}

export async function savePortfolioBundle(portfolioPath, body) {
  const json = typeof body === "string" ? body : JSON.stringify(body);
  JSON.parse(json);
  mkdirSync(dirname(portfolioPath), { recursive: true });
  await rotateBackups(portfolioPath);
  const tmp = `${portfolioPath}.tmp`;
  await writeFile(tmp, json, "utf-8");
  await rename(tmp, portfolioPath);
}

const PSX_TERMINAL = "https://psxterminal.com";

export async function fetchQuote(ticker) {
  try {
    const res = await fetch(
      `${PSX_TERMINAL}/api/fundamentals/${encodeURIComponent(ticker)}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success || !json.data) return null;
    return {
      ticker: json.data.symbol.toUpperCase(),
      current: json.data.price,
      changePct: json.data.changePercent,
    };
  } catch (err) {
    console.warn(`[psx] fetchQuote(${ticker}) failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function fetchDividend(ticker) {
  try {
    const res = await fetch(
      `${PSX_TERMINAL}/api/dividends/${encodeURIComponent(ticker)}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.success || !json.data || json.data.length === 0) return null;

    const todayTs = Date.now();
    const payouts = [];
    let earliestUpcoming = "";

    for (const rec of json.data) {
      const exTs = rec.ex_date ? new Date(rec.ex_date).getTime() : NaN;
      if (!Number.isFinite(exTs) || exTs < todayTs) continue;
      if (!(rec.amount > 0)) continue;

      payouts.push({
        announcementDate: rec.ex_date,
        bookClosureDate: rec.record_date,
        dividendPerShare: Math.round(rec.amount * 100) / 100,
      });

      if (
        rec.record_date &&
        (!earliestUpcoming || rec.record_date < earliestUpcoming)
      ) {
        earliestUpcoming = rec.record_date;
      }
    }

    if (payouts.length === 0) return null;

    const totalDps = payouts.reduce((s, p) => s + p.dividendPerShare, 0);

    return {
      ticker: ticker.toUpperCase(),
      dividendPerShare: Math.round(totalDps * 100) / 100,
      payoutDate: earliestUpcoming,
      payouts,
    };
  } catch (err) {
    console.warn(`[psx] fetchDividend(${ticker}) failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

export function createApiMiddleware({ dbPath, portfolioPath }) {
  return (req, res, next) => {
    const url = req.url ?? "";

    if (url.startsWith("/api/portfolio/load")) {
      (async () => {
        try {
          if (!existsSync(portfolioPath)) return sendJson(res, 200, "null");
          const raw = await readFile(portfolioPath, "utf-8");
          sendJson(res, 200, raw);
        } catch (err) {
          sendJson(res, 500, { error: String(err) });
        }
      })();
      return;
    }

    if (url.startsWith("/api/portfolio/save") && req.method === "POST") {
      serializeSave(async () => {
        try {
          const body = await readBody(req);
          await savePortfolioBundle(portfolioPath, body);
          sendJson(res, 200, { ok: true });
        } catch (err) {
          sendJson(res, 400, { error: String(err) });
        }
      });
      return;
    }

    if (url.startsWith("/api/psx/stocks")) {
      if (!existsSync(dbPath)) {
        return sendJson(res, 404, { error: "Run npm run fetch-stocks first" });
      }
      try {
        const db = new Database(dbPath, { readonly: true });
        const rows = db
          .prepare(
            "SELECT s.ticker, s.name, sec.name as sector FROM stocks s JOIN sectors sec ON s.sector = sec.code ORDER BY s.ticker",
          )
          .all();
        db.close();
        sendJson(res, 200, rows);
      } catch (err) {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    if (url.startsWith("/api/psx/dividends")) {
      const params = new URL(url, "http://localhost").searchParams;
      const tickers = (params.get("tickers") ?? "").split(",").filter(Boolean);
      if (tickers.length === 0) {
        return sendJson(res, 400, { error: "tickers param required" });
      }
      Promise.all(tickers.map(fetchDividend))
        .then((results) => sendJson(res, 200, results.filter(Boolean)))
        .catch((err) => {
          if (!res.headersSent) sendJson(res, 500, { error: String(err) });
        });
      return;
    }

    if (url.startsWith("/api/psx/market-data")) {
      const params = new URL(url, "http://localhost").searchParams;
      const tickers = (params.get("tickers") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tickers.length === 0) {
        return sendJson(res, 400, { error: "tickers param required" });
      }
      Promise.all(tickers.map(fetchQuote))
        .then((quotes) => sendJson(res, 200, quotes.filter((q) => q !== null)))
        .catch((err) => {
          if (!res.headersSent) {
            sendJson(res, 500, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        });
      return;
    }

    if (typeof next === "function") return next();
    sendJson(res, 404, { error: "not found" });
  };
}
