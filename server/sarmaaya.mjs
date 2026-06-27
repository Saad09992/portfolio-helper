import { fetchWithTimeout } from "./scrape-util.mjs";

const SARMAAYA = "https://sarmaaya.pk";
const SARMAAYA_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// sarmaaya.pk is a Next.js App Router app. The company page streams its data in
// `self.__next_f.push(...)` chunks where JSON is double-escaped (\" for quotes).
// The quote object looks like:
//   ...\"symbol\":\"ENGRO\",\"close\":485.38,\"low\":...,\"change\":7.08,
//      \"change_percentage\":1.48,\"date\":\"2025-02-25T12:45:26.031Z\"...
// We parse the price/change off that, falling back to the <title> for price.

/** Pull a numeric value for an escaped JSON key out of the streamed payload. */
function escapedNum(html, key) {
  const m = html.match(new RegExp(`\\\\"${key}\\\\":\\s*(-?[0-9]+(?:\\.[0-9]+)?)`));
  return m ? parseFloat(m[1]) : null;
}

function escapedStr(html, key) {
  const m = html.match(new RegExp(`\\\\"${key}\\\\":\\s*\\\\"([^\\\\"]+)\\\\"`));
  return m ? m[1] : null;
}

/**
 * Parse a sarmaaya company-page HTML into the same quote shape as the primary
 * source. Pure — unit-testable. Returns null when no price can be found.
 */
export function parseSarmaayaQuote(html, ticker) {
  let current = escapedNum(html, "close");

  // Fallback: <title>ENGRO - Rs 485.38 | ...>
  if (current === null || !Number.isFinite(current)) {
    const titleM = html.match(/<title>[^<]*?Rs\.?\s*([0-9,]+(?:\.[0-9]+)?)/i);
    if (titleM) current = parseFloat(titleM[1].replace(/,/g, ""));
  }
  if (current === null || !Number.isFinite(current)) return null;

  const change = escapedNum(html, "change");
  let changePct = escapedNum(html, "change_percentage");
  if (changePct === null || !Number.isFinite(changePct)) changePct = 0;
  // change_percentage is unsigned on some payloads — take sign from `change`.
  if (change !== null && change < 0) changePct = -Math.abs(changePct);

  const asOf = escapedStr(html, "date");

  return {
    ticker: ticker.toUpperCase(),
    current,
    changePct,
    asOf: asOf ?? null,
    source: "sarmaaya",
  };
}

export async function fetchQuoteSarmaaya(ticker) {
  try {
    const res = await fetchWithTimeout(
      `${SARMAAYA}/psx/company/${encodeURIComponent(ticker.toUpperCase())}`,
      { headers: { "User-Agent": SARMAAYA_UA } },
    );
    if (!res.ok) return null;
    const html = await res.text();
    return parseSarmaayaQuote(html, ticker);
  } catch (err) {
    console.warn(
      `[psx] fetchQuoteSarmaaya(${ticker}) failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

const TODAY_PROVIDER = () => Date.now();

/**
 * Parse upcoming payouts from a sarmaaya company page. NOTE: sarmaaya renders
 * the dividend table via a lazy React Server Component, so payout rows are NOT
 * present in the initial HTML — this returns null in practice today. Kept as a
 * best-effort parser (and future-proofing) that activates if the payout JSON
 * ever appears server-side. Pure — unit-testable.
 */
export function parseSarmaayaDividend(html, ticker, nowTs = TODAY_PROVIDER()) {
  // Look for an escaped payouts array of {amount, ex_date, record_date}.
  if (!/\\"(payouts|dividends)\\"\s*:\s*\[/.test(html)) return null;
  const payouts = [];
  let earliest = "";
  const re = /\\"amount\\":\s*(-?[0-9.]+)[^}]*?\\"ex_date\\":\s*\\"([^\\"]+)\\"[^}]*?\\"record_date\\":\s*\\"([^\\"]+)\\"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const amount = parseFloat(m[1]);
    const exDate = m[2];
    const recordDate = m[3];
    const exTs = new Date(exDate).getTime();
    if (!Number.isFinite(exTs) || exTs < nowTs) continue;
    if (!(amount > 0)) continue;
    payouts.push({
      announcementDate: exDate,
      bookClosureDate: recordDate,
      dividendPerShare: Math.round(amount * 100) / 100,
    });
    if (recordDate && (!earliest || recordDate < earliest)) earliest = recordDate;
  }
  if (payouts.length === 0) return null;
  const totalDps = payouts.reduce((s, p) => s + p.dividendPerShare, 0);
  return {
    ticker: ticker.toUpperCase(),
    dividendPerShare: Math.round(totalDps * 100) / 100,
    payoutDate: earliest,
    payouts,
    source: "sarmaaya",
  };
}

export async function fetchDividendSarmaaya(ticker) {
  try {
    const res = await fetchWithTimeout(
      `${SARMAAYA}/psx/company/${encodeURIComponent(ticker.toUpperCase())}`,
      { headers: { "User-Agent": SARMAAYA_UA } },
    );
    if (!res.ok) return null;
    const html = await res.text();
    const parsed = parseSarmaayaDividend(html, ticker);
    if (!parsed) {
      console.warn(
        `[psx] sarmaaya dividend fallback unavailable for ${ticker} (lazy-loaded; not in HTML)`,
      );
    }
    return parsed;
  } catch (err) {
    console.warn(
      `[psx] fetchDividendSarmaaya(${ticker}) failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
