import { fetchQuoteResilient, serializeSave } from "./api.mjs";
import { loadBundle as loadBundleDb, saveBundle } from "./portfolio-db.mjs";
import { fetchKse100 } from "./psx-index.mjs";
import {
  computeTotals,
  pkDateOf,
  pkParts,
  psxCloseStatus,
  upsertDailySnapshot,
} from "./portfolio-compute.mjs";

// Daily snapshot fires at 23:59 PKT so it captures the full day and lands
// before the PKT date rolls over to the next day. Scheduling is a Cloudflare
// Cron Trigger ("59 18 * * *" UTC); this module only decides whether a firing
// should actually snapshot.
const SNAPSHOT_HOUR_PKT = 23;
const SNAPSHOT_MIN_PKT = 59;

// Quote sources other than this are fallbacks. Used by the freshness rule below.
const PRIMARY_SOURCE = "dps";

// True once the current PKT wall-clock time is at/after the 23:59 snapshot mark.
function afterSnapshotTime(parts) {
  return parts.hour * 60 + parts.minute >= SNAPSHOT_HOUR_PKT * 60 + SNAPSHOT_MIN_PKT;
}

// PKT is UTC+5 fixed (no DST). Today's 15:30 PKT close instant = 10:30 UTC.
function pkCloseInstantMs(pkDate) {
  const [y, m, d] = String(pkDate).split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return Date.UTC(y, m - 1, d, 10, 30, 0);
}

/**
 * Split quotes into fresh (asOf >= today's PKT close) and stale.
 *
 * With `exemptFallbackSources`, a quote from a non-primary source is treated as
 * fresh without consulting its timestamp. Fallback sources report a shared
 * data-refresh stamp rather than a per-trade time, so comparing it to the close
 * tests the wrong thing — see the rule selection in runDailySync.
 */
export function quoteFreshness(quotes, closeMs, { exemptFallbackSources = false } = {}) {
  const fresh = [];
  const stale = [];
  for (const q of quotes) {
    if (exemptFallbackSources && isFallbackQuote(q)) {
      fresh.push(q);
      continue;
    }
    const ts = q && q.asOf ? Date.parse(q.asOf) : NaN;
    if (Number.isFinite(ts) && Number.isFinite(closeMs) && ts >= closeMs) fresh.push(q);
    else stale.push(q);
  }
  return { fresh, stale };
}

/** A quote whose timestamp cannot be compared to the close. */
function isFallbackQuote(q) {
  return Boolean(q && q.source && q.source !== PRIMARY_SOURCE);
}

/**
 * True when every quote came from a fallback source rather than the primary.
 *
 * Matters because the strict close-time gate assumes a per-stock trade
 * timestamp, which is what dps reports. The sarmaaya fallback instead reports
 * one shared data-refresh timestamp across all symbols — observed identical to
 * the millisecond for different tickers. If that stamp lags the 15:30 PKT
 * close, a strict gate would classify every quote stale and skip the snapshot
 * every single night, showing up only as silently missing history.
 */
export function allFromFallback(quotes) {
  return (
    quotes.length > 0 &&
    quotes.every((q) => q && q.source && q.source !== PRIMARY_SOURCE)
  );
}

function defaultLog(...args) {
  console.log("[psx:cron]", ...args);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Fetch prices and record the daily snapshot.
 *
 * `force` bypasses the 23:59 PKT window check. `dryRun` performs the whole
 * decision — fetches, freshness, totals — but skips the write and reports what
 * it would have done. dryRun exists because the scheduled path is otherwise
 * unobservable: it runs once a day, and a silent skip looks identical to a
 * silent crash days later.
 */
export async function runDailySync({
  db,
  log = defaultLog,
  force = false,
  dryRun = false,
} = {}) {
  const startedAt = Date.now();
  const bundle = await loadBundleDb(db);
  if (!bundle) {
    log("skip: no portfolio data");
    return { ran: false, reason: "no-portfolio", durationMs: Date.now() - startedAt };
  }

  if (!force) {
    if (!afterSnapshotTime(pkParts(new Date()))) {
      log("skip: before daily snapshot time (23:59 PKT)");
      return { ran: false, reason: "outside-window", durationMs: Date.now() - startedAt };
    }
  }

  // Stamp the snapshot's date at run start (≈23:59) so a scrape that finishes
  // just after midnight still keys to the day that's ending, not the new one.
  const snapshotIso = new Date().toISOString();

  const holdings = Array.isArray(bundle.holdings) ? bundle.holdings : [];
  const nonCash = holdings.filter((h) => !String(h.id ?? "").startsWith("cash-"));
  if (nonCash.length === 0) {
    log("skip: no non-cash holdings");
    return { ran: false, reason: "no-holdings", durationMs: Date.now() - startedAt };
  }

  const { pkDate, isWeekday: tradingDay } = psxCloseStatus();

  const tickers = nonCash
    .map((h) => String(h.ticker ?? "").toUpperCase())
    .filter(Boolean);

  const [stockQuotes, kse] = await Promise.all([
    Promise.all(tickers.map(fetchQuoteResilient)).then((a) => a.filter(Boolean)),
    fetchKse100().catch(() => null),
  ]);

  if (stockQuotes.length === 0) {
    log(`skip: 0 quotes returned (stocks ${tickers.length})`);
    return {
      ran: false,
      reason: "no-quotes",
      tickers: tickers.length,
      quoteCount: 0,
      kseSource: kse?.source ?? null,
      durationMs: Date.now() - startedAt,
    };
  }

  // Freshness gate applies ONLY on PSX trading days — on weekends/holidays
  // stocks legitimately have no new close, so snapshot the last close rather
  // than waiting/retrying.
  let freshStock = stockQuotes;
  let freshnessRule = "not-applicable";
  if (tradingDay && tickers.length > 0) {
    const closeMs = pkCloseInstantMs(pkDate);
    // Exempt fallback-sourced quotes from the close comparison; primary-sourced
    // ones are still held to it, so a genuinely pre-close dps quote still skips.
    const { fresh, stale } = quoteFreshness(stockQuotes, closeMs, {
      exemptFallbackSources: true,
    });
    const missingCount = tickers.length - stockQuotes.length;
    const exempted = stockQuotes.filter(isFallbackQuote);

    if (stale.length === 0 && missingCount === 0) {
      // Three shapes, distinguished for the audit trail:
      //   strict          every quote from the primary source, all post-close
      //   relaxed-fallback  no primary source answered at all
      //   relaxed-mixed   some answered, some fell back
      //
      // The mixed case used to skip. That was wrong in exactly the way that
      // hurts most: an all-fallback night snapshots, and a night where the
      // primary partially recovers does not — so the job silently stops the
      // moment the upstream starts flapping, which is what happened when dps
      // came back after several days of returning 520 from Cloudflare.
      if (exempted.length === 0) {
        freshnessRule = "strict";
      } else {
        const sources = [...new Set(exempted.map((q) => q.source))].join(",");
        const newest = exempted.map((q) => q.asOf).filter(Boolean).sort().pop();
        freshnessRule =
          exempted.length === stockQuotes.length ? "relaxed-fallback" : "relaxed-mixed";
        log(
          `freshness: ${freshnessRule.toUpperCase()} — ${exempted.length}/${stockQuotes.length} ` +
            `quote(s) from fallback source(s) [${sources}] exempted from the close-time gate; ` +
            `newest fallback asOf=${newest ?? "unknown"} (close was 15:30 PKT on ${pkDate})`,
        );
      }
      freshStock = fresh;
    } else {
      const staleTickers = stale.map((q) => q.ticker).join(",");
      log(
        `skip: quotes not settled — fresh=${fresh.length}/${tickers.length}, stale=${stale.length}, missing=${missingCount}${staleTickers ? `, staleTickers=${staleTickers}` : ""}`,
      );
      return {
        ran: false,
        reason: "quotes-stale",
        fresh: fresh.length,
        stale: stale.length,
        missing: missingCount,
        tickers: tickers.length,
        quoteCount: stockQuotes.length,
        sources: [...new Set(stockQuotes.map((q) => q.source))].join(","),
        kseSource: kse?.source ?? null,
        pkDate,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  const quoteCount = freshStock.length;

  const quoteMap = new Map();
  for (const q of freshStock) quoteMap.set(q.ticker.toUpperCase(), q);

  const updatedHoldings = holdings.map((h) => {
    if (String(h.id ?? "").startsWith("cash-")) return h;
    const q = quoteMap.get(String(h.ticker ?? "").toUpperCase());
    if (!q) return h;
    return {
      ...h,
      // Scraped price is rupees → store as integer paisa (matches client).
      price: Math.round(q.current * 100),
      dayChangePct: round2(q.changePct),
    };
  });

  const cashAvailable = Number(bundle.cash?.available ?? 0) || 0;
  const totals = computeTotals(updatedHoldings, cashAvailable);

  const nowIso = new Date().toISOString();
  const shares = {};
  for (const h of updatedHoldings) {
    if (String(h.id ?? "").startsWith("cash-")) continue;
    const ticker = String(h.ticker ?? "").toUpperCase();
    if (!ticker) continue;
    shares[ticker] = Number(h.shares) || 0;
  }
  const entry = {
    date: snapshotIso,
    ...(kse && Number.isFinite(kse.current) ? { kse100: kse.current } : {}),
    totalValue: totals.totalValue,
    totalCost: totals.totalCost,
    gainLoss: totals.totalGainLoss,
    shares,
  };

  const history = upsertDailySnapshot(
    Array.isArray(bundle.history) ? bundle.history : [],
    entry,
    pkDateOf,
  );

  const nextBundle = {
    ...bundle,
    holdings: updatedHoldings,
    history,
    lastFetchedAt: nowIso,
    savedAt: nowIso,
  };

  if (dryRun) {
    log(`dry-run: would snapshot (freshness=${freshnessRule}) — not writing`);
    return {
      ran: false,
      reason: "dry-run",
      wouldSnapshot: true,
      entry,
      quoteCount,
      freshnessRule,
      tickers: tickers.length,
      sources: [...new Set(freshStock.map((q) => q.source))].join(","),
      kseSource: kse?.source ?? null,
      pkDate,
      durationMs: Date.now() - startedAt,
    };
  }

  await serializeSave(() => saveBundle(db, nextBundle));

  log(
    `synced: ${quoteCount} quotes (stocks ${freshStock.length}/${tickers.length}), ` +
      `freshness=${freshnessRule}, kse100=${kse ? `${kse.current} via ${kse.source}` : "unavailable"}, ` +
      `value=${totals.totalValue.toFixed(2)}, gainLoss=${totals.totalGainLoss.toFixed(2)}, pkDate=${pkDateOf(snapshotIso)}`,
  );
  return {
    ran: true,
    entry,
    quoteCount,
    freshnessRule,
    tickers: tickers.length,
    sources: [...new Set(freshStock.map((q) => q.source))].join(","),
    kseSource: kse?.source ?? null,
    pkDate,
    durationMs: Date.now() - startedAt,
  };
}
