import Database from "better-sqlite3";
import { z } from "zod";
import { existsSync, mkdirSync } from "fs";
import { getPortfolioDb, loadBundle, saveBundle } from "./portfolio-db.mjs";
import { copyFile, rename, rm, writeFile } from "fs/promises";
import { dirname } from "path";
import { fetchWithTimeout, withRetry } from "./scrape-util.mjs";
import { fetchQuoteSarmaaya, fetchDividendSarmaaya } from "./sarmaaya.mjs";
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

// Comma-separated tickers → cleaned, non-empty array. Rejects empty input.
const tickersSchema = z
  .string()
  .transform((s) => s.split(",").map((t) => t.trim()).filter(Boolean))
  .refine((arr) => arr.length > 0, { message: "tickers param required" });

// Register all /api routes on a Hono app. Methods are pinned (no more
// prefix/method-agnostic startsWith matching), and inputs are Zod-validated.
export function registerApiRoutes(app, { dbPath, portfolioDbPath }) {
  app.get("/api/portfolio/load", (c) => {
    try {
      const bundle = loadBundle(getPortfolioDb(portfolioDbPath));
      return c.json(bundle);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  app.post("/api/portfolio/save", async (c) => {
    const body = await c.req.text();
    return serializeSave(async () => {
      try {
        saveBundle(getPortfolioDb(portfolioDbPath), body);
        return c.json({ ok: true });
      } catch (err) {
        return c.json({ error: String(err) }, 400);
      }
    });
  });

  app.get("/api/psx/stocks", (c) => {
    if (!existsSync(dbPath)) {
      return c.json({ error: "Run npm run fetch-stocks first" }, 404);
    }
    try {
      const db = new Database(dbPath, { readonly: true });
      const rows = db
        .prepare(
          "SELECT s.ticker, s.name, sec.name as sector FROM stocks s JOIN sectors sec ON s.sector = sec.code ORDER BY s.ticker",
        )
        .all();
      db.close();
      return c.json(rows);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        500,
      );
    }
  });

  app.get("/api/psx/dividends", async (c) => {
    const parsed = tickersSchema.safeParse(c.req.query("tickers") ?? "");
    if (!parsed.success) {
      return c.json({ error: "tickers param required" }, 400);
    }
    try {
      const results = await Promise.all(parsed.data.map(fetchDividendResilient));
      return c.json(results.filter(Boolean));
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  app.get("/api/psx/benchmark", async (c) => {
    const wantHistory = c.req.query("history") != null;
    try {
      const kse = await fetchKse100();
      if (!kse) return c.json(null);
      const body = wantHistory
        ? kse
        : { current: kse.current, asOf: kse.asOf, changePct: kse.changePct };
      return c.json(body);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  app.get("/api/psx/market-data", async (c) => {
    const parsed = tickersSchema.safeParse(c.req.query("tickers") ?? "");
    if (!parsed.success) {
      return c.json({ error: "tickers param required" }, 400);
    }
    try {
      const quotes = await Promise.all(parsed.data.map(fetchQuoteResilient));
      return c.json(quotes.filter((q) => q !== null));
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : String(err) },
        500,
      );
    }
  });
}
