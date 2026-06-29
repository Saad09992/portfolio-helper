import { fetchWithTimeout } from "./scrape-util.mjs";

const PSX_DPS = "https://dps.psx.com.pk";
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
  };
}

/** Fetch the KSE100 index (current level + eod history). Returns null on failure. */
export async function fetchKse100() {
  try {
    const res = await fetchWithTimeout(`${PSX_DPS}/timeseries/eod/KSE100`, {
      headers: { "User-Agent": DPS_UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return parseEodTimeseries(json);
  } catch (err) {
    console.warn(
      `[psx] fetchKse100 failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
