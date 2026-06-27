import { fetchWithTimeout } from "./scrape-util.mjs";

const CG = "https://api.coingecko.com/api/v3";
const CG_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Tiny in-memory cache to stay well under CoinGecko's free rate limit.
const CACHE_TTL_MS = 30_000;
const cache = new Map(); // key -> { at, value }

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return null;
  return hit.value;
}
function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Search coins by query → [{ id, symbol, name }]. */
export async function searchCoins(query) {
  const q = String(query ?? "").trim();
  if (!q) return [];
  const key = `search:${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const res = await fetchWithTimeout(
      `${CG}/search?query=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": CG_UA, Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const json = await res.json();
    const coins = Array.isArray(json.coins) ? json.coins : [];
    const out = coins.slice(0, 15).map((c) => ({
      id: c.id,
      symbol: String(c.symbol ?? "").toUpperCase(),
      name: c.name,
    }));
    return cacheSet(key, out);
  } catch (err) {
    console.warn(
      `[crypto] searchCoins(${q}) failed:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/** Pure mapper: CoinGecko /simple/price JSON → quote rows. Unit-testable. */
export function mapSimplePrice(json, ids) {
  const out = [];
  for (const id of ids) {
    const row = json?.[id];
    if (!row || typeof row.pkr !== "number") continue;
    out.push({
      coinId: id,
      ticker: "",
      current: row.pkr,
      usdPrice: typeof row.usd === "number" ? row.usd : 0,
      changePct: typeof row.pkr_24h_change === "number" ? row.pkr_24h_change : 0,
      source: "coingecko",
    });
  }
  return out;
}

/**
 * Quotes for CoinGecko ids, priced in PKR (with native USD + 24h change).
 * Returns [{ coinId, ticker, current, usdPrice, changePct, source }].
 * `ticker` is left empty here (the client already knows the holding ticker);
 * matching is by coinId.
 */
export async function fetchCryptoQuotes(ids) {
  const list = (Array.isArray(ids) ? ids : []).map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return [];
  const key = `price:${[...list].sort().join(",")}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const res = await fetchWithTimeout(
      `${CG}/simple/price?ids=${encodeURIComponent(list.join(","))}` +
        `&vs_currencies=pkr,usd&include_24hr_change=true`,
      { headers: { "User-Agent": CG_UA, Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const json = await res.json();
    return cacheSet(key, mapSimplePrice(json, list));
  } catch (err) {
    console.warn(
      `[crypto] fetchCryptoQuotes failed:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
