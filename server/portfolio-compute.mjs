// Pure-math helpers used by the server-side cron. Ported from front-end
// sources (src/portfolio/calendar.ts, src/utils.ts, src/portfolio/holdings.ts,
// src/constants.ts). Kept dependency-free so the server runtime needs no TS
// build step.

const HISTORY_MAX_DAYS = 365;

export function pkParts(now) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
  };
}

export function psxCloseStatus(now = new Date()) {
  const p = pkParts(now);
  const isWeekday = !["Sat", "Sun"].includes(p.weekday);
  const afterClose = p.hour > 15 || (p.hour === 15 && p.minute >= 30);
  return { isWeekday, afterClose, pkDate: p.date };
}

export function pkDateOf(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return pkParts(d).date;
}

export function upsertDailySnapshot(
  history,
  entry,
  pkDateOfFn = pkDateOf,
  maxLen = HISTORY_MAX_DAYS,
) {
  const key = pkDateOfFn(entry.date);
  const idx = history.findIndex((s) => pkDateOfFn(s.date) === key);
  if (idx !== -1) {
    const next = history.slice();
    next[idx] = entry;
    return next;
  }
  return [...history, entry].slice(-maxLen);
}

// Collapsed equivalent of buildHoldingsWithCash + computePortfolio. Server
// only needs portfolio-level totals — no per-holding weights or derivations.
export function computeTotals(holdings, cashAvailable = 0) {
  const nonCash = holdings.filter((h) => !String(h.id ?? "").startsWith("cash-"));

  let totalValue = 0;
  let totalCost = 0;
  for (const h of nonCash) {
    const shares = Number(h.shares) || 0;
    const price = Number(h.price) || 0;
    const cost = Number(h.costBasis) || 0;
    totalValue += shares * price;
    totalCost += shares * cost;
  }

  const cash = Number(cashAvailable) || 0;
  if (cash > 0) {
    totalValue += cash;
    totalCost += cash;
  }

  return { totalValue, totalCost, totalGainLoss: totalValue - totalCost };
}
