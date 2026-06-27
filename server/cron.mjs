import { existsSync } from "fs";
import { readFile } from "fs/promises";
import {
  fetchQuoteResilient,
  serializeSave,
  savePortfolioBundle,
} from "./api.mjs";
import {
  computeTotals,
  pkDateOf,
  pkParts,
  psxCloseStatus,
  upsertDailySnapshot,
} from "./portfolio-compute.mjs";

const CLOSE_HOUR_PKT = 15;
const CLOSE_MIN_PKT = 30;
const RUN_OFFSET_MIN = 5; // fire at 15:35 PKT — buffer for PSX API to settle
const STALE_RETRY_MS = 10 * 60_000; // retry every 10 min when prices haven't settled
const STALE_GIVE_UP_HOUR_PKT = 19; // stop retrying after 19:00 PKT — no snapshot for the day

// PKT is UTC+5 fixed (no DST). Today's 15:30 PKT close instant = 10:30 UTC.
function pkCloseInstantMs(pkDate) {
  const [y, m, d] = String(pkDate).split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return Date.UTC(y, m - 1, d, 10, 30, 0);
}

// Split quotes into fresh (asOf >= today's PKT close) and stale.
export function quoteFreshness(quotes, closeMs) {
  const fresh = [];
  const stale = [];
  for (const q of quotes) {
    const ts = q && q.asOf ? Date.parse(q.asOf) : NaN;
    if (Number.isFinite(ts) && Number.isFinite(closeMs) && ts >= closeMs) fresh.push(q);
    else stale.push(q);
  }
  return { fresh, stale };
}

function defaultLog(...args) {
  console.log("[psx:cron]", ...args);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function loadBundle(portfolioPath) {
  if (!existsSync(portfolioPath)) return null;
  const raw = await readFile(portfolioPath, "utf-8");
  if (!raw.trim() || raw.trim() === "null") return null;
  return JSON.parse(raw);
}

// ms from `now` until next 15:35 PKT that falls on Mon–Fri. Walks day by day
// in Karachi time so DST / month / year rollovers fall out of Intl.
function msUntilNextRun(now = new Date()) {
  let candidate = new Date(now.getTime());
  for (let i = 0; i < 14; i++) {
    const p = pkParts(candidate);
    const targetMin = CLOSE_HOUR_PKT * 60 + CLOSE_MIN_PKT + RUN_OFFSET_MIN;
    const currentMin = p.hour * 60 + p.minute;
    const sameDayValid =
      i > 0 || currentMin < targetMin; // today only if we haven't passed 15:35 yet
    const isWeekday = !["Sat", "Sun"].includes(p.weekday);

    if (isWeekday && sameDayValid) {
      // Construct the target instant by binary-searching minute offsets — but
      // since Intl is one-way (instant → wall clock), just step minute by
      // minute from a coarse anchor. Simpler: probe instants at 1-min
      // granularity within the day until pkParts reports target wall clock.
      const dayAnchor = new Date(candidate.getTime());
      // Start at 00:00 PKT for this PKT date by stepping back to find local
      // midnight, then add target minutes.
      // pkParts gives current wall clock; subtract its minutes to land on
      // PKT midnight, then add target.
      const ms =
        dayAnchor.getTime() -
        (p.hour * 60 + p.minute) * 60_000 +
        targetMin * 60_000;
      if (ms > now.getTime()) return ms - now.getTime();
    }
    // Advance candidate by 24h and retry
    candidate = new Date(candidate.getTime() + 24 * 60 * 60_000);
  }
  // Fallback (should never hit): 1h
  return 60 * 60_000;
}

export async function runDailySync({
  portfolioPath,
  log = defaultLog,
  force = false,
} = {}) {
  const bundle = await loadBundle(portfolioPath);
  if (!bundle) {
    log("skip: no portfolio.json");
    return { ran: false, reason: "no-portfolio" };
  }

  if (!force) {
    const { isWeekday, afterClose } = psxCloseStatus();
    if (!isWeekday || !afterClose) {
      log("skip: outside PSX post-close window");
      return { ran: false, reason: "outside-window" };
    }
  }

  const holdings = Array.isArray(bundle.holdings) ? bundle.holdings : [];
  const nonCash = holdings.filter((h) => !String(h.id ?? "").startsWith("cash-"));
  if (nonCash.length === 0) {
    log("skip: no non-cash holdings");
    return { ran: false, reason: "no-holdings" };
  }

  const tickers = nonCash.map((h) => String(h.ticker ?? "").toUpperCase()).filter(Boolean);
  const quotes = (await Promise.all(tickers.map(fetchQuoteResilient))).filter(Boolean);

  if (quotes.length === 0) {
    log(`skip: 0/${tickers.length} quotes returned`);
    return { ran: false, reason: "no-quotes" };
  }

  const { pkDate } = psxCloseStatus();
  const closeMs = pkCloseInstantMs(pkDate);
  const { fresh, stale } = quoteFreshness(quotes, closeMs);
  const missingCount = tickers.length - quotes.length;
  if (stale.length > 0 || missingCount > 0) {
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
    };
  }

  const quoteMap = new Map();
  for (const q of fresh) quoteMap.set(q.ticker.toUpperCase(), q);

  const updatedHoldings = holdings.map((h) => {
    if (String(h.id ?? "").startsWith("cash-")) return h;
    const q = quoteMap.get(String(h.ticker ?? "").toUpperCase());
    if (!q) return h;
    return {
      ...h,
      price: round2(q.current),
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
    date: nowIso,
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

  await serializeSave(() => savePortfolioBundle(portfolioPath, nextBundle));

  log(
    `synced: ${quotes.length}/${tickers.length} quotes, value=${totals.totalValue.toFixed(2)}, gainLoss=${totals.totalGainLoss.toFixed(2)}, pkDate=${pkDateOf(nowIso)}`,
  );
  return { ran: true, entry, quoteCount: quotes.length };
}

export function startScheduler({ portfolioPath, log = defaultLog } = {}) {
  let timer = null;
  let stopped = false;

  const withinStaleRetryWindow = () => {
    const p = pkParts(new Date());
    return p.hour < STALE_GIVE_UP_HOUR_PKT;
  };

  const scheduleIn = (delay, tag, fn) => {
    if (stopped) return;
    const fireAt = new Date(Date.now() + delay).toISOString();
    log(`${tag} scheduled in ${Math.round(delay / 60_000)}m at ${fireAt}`);
    timer = setTimeout(fn, delay);
    if (typeof timer.unref === "function") timer.unref();
  };

  const runAndReschedule = async () => {
    let result;
    try {
      result = await runDailySync({ portfolioPath, log });
    } catch (err) {
      log(`run failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (result && result.reason === "quotes-stale") {
      if (withinStaleRetryWindow()) {
        scheduleIn(STALE_RETRY_MS, "stale-retry", runAndReschedule);
        return;
      }
      log(`stale-retry give-up: past ${STALE_GIVE_UP_HOUR_PKT}:00 PKT, no snapshot for today`);
    }
    scheduleNext();
  };

  const scheduleNext = () => {
    scheduleIn(msUntilNextRun(new Date()), "next run", runAndReschedule);
  };

  // Catch-up on boot: if we're inside the post-close window and today's PKT
  // date isn't yet in history, fire immediately. Also fires when caller sets
  // CRON_RUN_ON_BOOT=1 (handled by env-guarded force flag in caller).
  const catchUp = async () => {
    try {
      const bundle = await loadBundle(portfolioPath);
      const { isWeekday, afterClose, pkDate } = psxCloseStatus();
      if (!bundle || !isWeekday || !afterClose) return { stale: false };
      const history = Array.isArray(bundle.history) ? bundle.history : [];
      const haveToday = history.some((s) => pkDateOf(s.date) === pkDate);
      if (haveToday) {
        log(`catch-up skip: today (${pkDate}) already in history`);
        return { stale: false };
      }
      log(`catch-up: today (${pkDate}) missing, running now`);
      const res = await runDailySync({ portfolioPath, log });
      return { stale: res && res.reason === "quotes-stale" };
    } catch (err) {
      log(`catch-up failed: ${err instanceof Error ? err.message : String(err)}`);
      return { stale: false };
    }
  };

  catchUp().then(({ stale }) => {
    if (stale && withinStaleRetryWindow()) {
      scheduleIn(STALE_RETRY_MS, "stale-retry", runAndReschedule);
    } else {
      scheduleNext();
    }
  });

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  };
}
