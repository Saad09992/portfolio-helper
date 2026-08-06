import { fetchWithTimeout } from "./scrape-util.mjs";

const PSX_DPS = "https://dps.psx.com.pk";
const PSX_WWW = "https://www.psx.com.pk";
const DPS_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Unix seconds → PKT (UTC+5) calendar date string YYYY-MM-DD. */
function pktDate(unixSec) {
  return new Date((unixSec + 5 * 3600) * 1000).toISOString().slice(0, 10);
}

/**
 * Pure parser for the dps eod timeseries JSON:
 *   { status, data: [[unixSec, close, volume, ...], ...] }  (latest first)
 * Returns { current, asOf, changePct, series:[{date, close}] (ascending) } or null.
 */
export function parseEodTimeseries(json) {
  if (!json || json.status !== 1 || !Array.isArray(json.data) || json.data.length === 0) {
    return null;
  }
  const rows = json.data
    .filter((r) => Array.isArray(r) && Number.isFinite(r[0]) && Number.isFinite(r[1]))
    .map((r) => ({ ts: r[0], date: pktDate(r[0]), close: r[1] }));
  if (rows.length === 0) return null;

  // Input is newest-first; sort ascending for a usable series.
  rows.sort((a, b) => a.ts - b.ts);
  const last = rows[rows.length - 1];
  const prev = rows.length >= 2 ? rows[rows.length - 2] : null;
  const changePct = prev && prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0;

  return {
    current: last.close,
    asOf: new Date(last.ts * 1000).toISOString(),
    changePct,
    series: rows.map((r) => ({ date: r.date, close: r.close })),
    source: "dps",
  };
}

/**
 * Pure parser for the index summary table on the psx.com.pk home page. Used as
 * the fallback when the dps timeseries endpoint is unreachable.
 *
 * The markup is a plain server-rendered table with stable element ids:
 *   <td id="curIndex">180,756.91</td>
 *   <td id="cahnge">741.98</td>          <-- misspelled upstream; matched as-is
 *   <td id="percentchange">0.41%</td>
 *
 * Returns the same shape as parseEodTimeseries minus `series` — the home page
 * carries only the current level, no history. Nothing consumes `series`
 * (/api/psx/benchmark?history has no caller), so an empty array is not a
 * regression; it is called out here so a future series consumer doesn't
 * silently get nothing.
 */
export function parsePsxIndexPage(html) {
  if (typeof html !== "string" || html.length === 0) return null;

  const numById = (id) => {
    const m = html.match(
      new RegExp(`id="${id}"[^>]*>\\s*(-?[0-9,]+(?:\\.[0-9]+)?)`, "i"),
    );
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  const current = numById("curIndex");
  if (current === null || !(current > 0)) return null;

  const change = numById("cahnge");
  const pctM = html.match(/id="percentchange"[^>]*>\s*(-?[0-9.]+)\s*%/i);
  let changePct = pctM ? parseFloat(pctM[1]) : 0;
  if (!Number.isFinite(changePct)) changePct = 0;
  // The percent cell is unsigned on down days — take the sign from `change`.
  if (change !== null && change < 0) changePct = -Math.abs(changePct);

  return {
    current,
    // The page has no timestamp for the quote itself; stamp fetch time so the
    // freshness gate has something monotonic to compare against.
    asOf: new Date().toISOString(),
    changePct,
    series: [],
    source: "psx-www",
  };
}

/** Primary: dps eod timeseries (current level + full history). */
export async function fetchKse100Dps() {
  try {
    const res = await fetchWithTimeout(`${PSX_DPS}/timeseries/eod/KSE100`, {
      headers: { "User-Agent": DPS_UA, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[psx] fetchKse100Dps: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    return parseEodTimeseries(json);
  } catch (err) {
    console.warn(
      `[psx] fetchKse100Dps failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Fallback: psx.com.pk home page (current level only, no history). */
export async function fetchKse100Www() {
  try {
    const res = await fetchWithTimeout(`${PSX_WWW}/`, {
      headers: { "User-Agent": DPS_UA },
    });
    if (!res.ok) {
      console.warn(`[psx] fetchKse100Www: HTTP ${res.status}`);
      return null;
    }
    return parsePsxIndexPage(await res.text());
  } catch (err) {
    console.warn(
      `[psx] fetchKse100Www failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetch the KSE100 index. Primary is dps; falls back to the psx.com.pk home
 * page when dps is unreachable.
 *
 * dps is kept as primary deliberately even though it currently fails from
 * Cloudflare egress (its dynamic endpoints return 520 there while its own
 * homepage serves fine). Keeping the order means the richer source is used
 * automatically again if it recovers, at the cost of one fast-failing request.
 */
export async function fetchKse100() {
  const primary = await fetchKse100Dps();
  if (primary) return primary;
  console.warn("[psx] KSE100 primary (dps) unavailable — trying psx.com.pk");
  return fetchKse100Www();
}
