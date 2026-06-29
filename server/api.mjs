import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { copyFile, readFile, rename, rm, writeFile } from "fs/promises";
import { dirname } from "path";
import { fetchWithTimeout, withRetry } from "./scrape-util.mjs";
import { fetchQuoteSarmaaya, fetchDividendSarmaaya } from "./sarmaaya.mjs";
import { searchCoins, fetchCryptoQuotes } from "./coingecko.mjs";
import { fetchMetalQuotes } from "./metals.mjs";
import { fetchKse100 } from "./psx-index.mjs";

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

const PSX_DPS = "https://dps.psx.com.pk";
const DPS_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Scrape the official PSX Data Portal company page for the latest quote.
export async function fetchQuote(ticker) {
  try {
    const res = await fetchWithTimeout(
      `${PSX_DPS}/company/${encodeURIComponent(ticker)}`,
      { headers: { "User-Agent": DPS_UA } },
    );
    if (!res.ok) return null;
    const html = await res.text();

    // Anchor on the main quote block so we don't match the index ticker widget.
    const start = html.indexOf("quote__price");
    if (start === -1) return null;
    const block = html.slice(start, start + 600);

    const priceM = block.match(
      /quote__close[^>]*>\s*Rs\.?\s*([0-9,]+(?:\.[0-9]+)?)/i,
    );
    if (!priceM) return null;
    const current = parseFloat(priceM[1].replace(/,/g, ""));
    if (!Number.isFinite(current)) return null;

    const signM = block.match(/quote__change\s+change__text--(pos|neg)/i);
    const pctM = block.match(
      /change__percent[^>]*>\s*\(\s*(-?[0-9.]+)\s*%\s*\)/i,
    );
    let changePct = pctM ? Math.abs(parseFloat(pctM[1])) : 0;
    if (signM && signM[1] === "neg") changePct = -changePct;

    const dateM = html.match(/quote__date[^>]*>\s*\^?\s*As of\s*([^<]+)/i);

    return {
      ticker: ticker.toUpperCase(),
      current,
      changePct,
      asOf: dateM ? dateM[1].trim() : null,
      source: "dps",
    };
  } catch (err) {
    console.warn(`[psx] fetchQuote(${ticker}) failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// Primary (dps, with timeout + 1 retry) → fallback (sarmaaya). Each result is
// tagged with its `source` so the client can surface fallbacks.
export async function fetchQuoteResilient(ticker) {
  const primary = await withRetry(() => fetchQuote(ticker));
  if (primary) return primary;
  return fetchQuoteSarmaaya(ticker);
}

// Dividends: psxterminal.com was abandoned (host dead — connection refused, and
// its /api/fundamentals already reset the HTTP/2 stream). sarmaaya is now the
// only dividend source. NOTE: sarmaaya renders payouts via a client-only React
// Server Component, so they are not present in the server HTML — this usually
// returns null today (logged in fetchDividendSarmaaya) until a structured
// source becomes available. Price (dps → sarmaaya) is unaffected.
async function fetchDividendResilient(ticker) {
  return fetchDividendSarmaaya(ticker);
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
      Promise.all(tickers.map(fetchDividendResilient))
        .then((results) => sendJson(res, 200, results.filter(Boolean)))
        .catch((err) => {
          if (!res.headersSent) sendJson(res, 500, { error: String(err) });
        });
      return;
    }

    if (url.startsWith("/api/psx/benchmark")) {
      const wantHistory = new URL(url, "http://localhost").searchParams.get("history");
      fetchKse100()
        .then((kse) => {
          if (!kse) return sendJson(res, 200, null);
          const body = wantHistory
            ? kse
            : { current: kse.current, asOf: kse.asOf, changePct: kse.changePct };
          sendJson(res, 200, body);
        })
        .catch((err) => {
          if (!res.headersSent) sendJson(res, 500, { error: String(err) });
        });
      return;
    }

    if (url.startsWith("/api/crypto/search")) {
      const params = new URL(url, "http://localhost").searchParams;
      const q = params.get("q") ?? "";
      searchCoins(q)
        .then((coins) => sendJson(res, 200, coins))
        .catch((err) => {
          if (!res.headersSent) sendJson(res, 500, { error: String(err) });
        });
      return;
    }

    if (url.startsWith("/api/crypto/market-data")) {
      const params = new URL(url, "http://localhost").searchParams;
      const ids = (params.get("ids") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        return sendJson(res, 400, { error: "ids param required" });
      }
      fetchCryptoQuotes(ids)
        .then((quotes) => sendJson(res, 200, quotes))
        .catch((err) => {
          if (!res.headersSent) sendJson(res, 500, { error: String(err) });
        });
      return;
    }

    if (url.startsWith("/api/metals/market-data")) {
      const params = new URL(url, "http://localhost").searchParams;
      const metals = (params.get("metals") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (metals.length === 0) {
        return sendJson(res, 400, { error: "metals param required" });
      }
      fetchMetalQuotes(metals)
        .then((quotes) => sendJson(res, 200, quotes))
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
      Promise.all(tickers.map(fetchQuoteResilient))
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
