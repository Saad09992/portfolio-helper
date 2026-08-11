import { z } from "zod";
import { currentVersion, loadBundle, saveBundle } from "./portfolio-db.mjs";
import { fetchWithTimeout, withRetry } from "./scrape-util.mjs";
import { fetchQuoteSarmaaya, fetchDividendSarmaaya } from "./sarmaaya.mjs";
import { fetchKse100 } from "./psx-index.mjs";

// Serialize saves so overlapping requests apply in order. On Workers this only
// orders saves within a single isolate — the real atomicity guarantee comes from
// the D1 batch inside saveBundle(), which is all-or-nothing regardless.
let saveQueue = Promise.resolve();
export function serializeSave(work) {
  const next = saveQueue.then(work, work);
  // Swallow errors on the queue so one failure does not block subsequent saves
  saveQueue = next.catch(() => undefined);
  return next;
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
//
// From Cloudflare egress the dps leg currently always fails (its dynamic
// endpoints return 520 there), so sarmaaya serves in practice. dps is kept
// first so the richer source resumes automatically if it recovers; each failed
// attempt costs ~700ms and 2 of the 50-subrequest budget.
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

/**
 * Register all /api routes on a Hono app.
 *
 * `getDb(c)` resolves the storage adapter from the request context — on Workers
 * that wraps `env.DB`, in tests/dev it wraps better-sqlite3. `getStocks(c)`
 * returns the reference stock list.
 */
export function registerApiRoutes(app, { getDb, getStocks }) {
  app.get("/api/portfolio/load", async (c) => {
    try {
      const bundle = await loadBundle(getDb(c));
      return c.json(bundle);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // Optimistic concurrency. The client echoes back the `savedAt` it loaded; if
  // the stored one has moved since, the write is refused rather than applied.
  //
  // Saves are whole-bundle full-replace, so without this the last writer wins
  // unconditionally — which meant a browser tab left open across 23:59 would
  // push its pre-cron copy back over the nightly snapshot, silently undoing it.
  // Clients that send no base version are still accepted, so an older tab
  // degrades to the previous behaviour rather than breaking.
  app.post("/api/portfolio/save", async (c) => {
    const body = await c.req.text();
    const base = c.req.header("x-psx-base-savedat");
    const db = getDb(c);
    return serializeSave(async () => {
      try {
        if (base) {
          const stored = await currentVersion(db);
          if (stored && stored !== base) {
            return c.json(
              {
                error: "conflict",
                message:
                  "The stored portfolio changed since this copy was loaded. Reload and reapply.",
                currentSavedAt: stored,
                bundle: await loadBundle(db),
              },
              409,
            );
          }
        }
        await saveBundle(db, body);
        return c.json({ ok: true });
      } catch (err) {
        return c.json({ error: String(err) }, 400);
      }
    });
  });

  app.get("/api/psx/stocks", async (c) => {
    try {
      const rows = await getStocks(c);
      if (!rows) return c.json({ error: "stock list unavailable" }, 404);
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
