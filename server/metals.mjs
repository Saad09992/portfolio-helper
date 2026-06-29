import { fetchWithTimeout } from "./scrape-util.mjs";

const GOLD_API = "https://api.gold-api.com/price";
const FX_API = "https://open.er-api.com/v6/latest/USD";
const GRAMS_PER_TROY_OZ = 31.1034768;

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Spot + FX move slowly; cache 60s to stay friendly to the free endpoints.
const CACHE_TTL_MS = 60_000;
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

const SYMBOL = { gold: "XAU", silver: "XAG" };

async function fetchUsdToPkr() {
  const cached = cacheGet("fx:usdpkr");
  if (cached) return cached;
  const res = await fetchWithTimeout(FX_API, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`FX API ${res.status}`);
  const json = await res.json();
  const rate = json?.rates?.PKR;
  if (typeof rate !== "number" || rate <= 0) throw new Error("FX rate missing");
  return cacheSet("fx:usdpkr", rate);
}

async function fetchSpotUsdPerOz(metalId) {
  const symbol = SYMBOL[metalId];
  if (!symbol) return null;
  const key = `spot:${symbol}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const res = await fetchWithTimeout(`${GOLD_API}/${symbol}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const price = Number(json?.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  return cacheSet(key, price);
}

/**
 * Quotes for metal ids, priced in PKR per gram (+ native USD per gram).
 * Returns [{ metalId, ticker, current, usdPrice, changePct, source }].
 */
export async function fetchMetalQuotes(ids) {
  const list = (Array.isArray(ids) ? ids : [])
    .map((s) => String(s).trim().toLowerCase())
    .filter((s) => s in SYMBOL);
  if (list.length === 0) return [];

  const fx = await fetchUsdToPkr();
  const out = [];
  for (const metalId of list) {
    const usdPerOz = await fetchSpotUsdPerOz(metalId);
    if (usdPerOz === null) continue;
    const usdPerGram = usdPerOz / GRAMS_PER_TROY_OZ;
    const pkrPerGram = usdPerGram * fx;
    out.push({
      metalId,
      ticker: metalId.toUpperCase(),
      current: Math.round(pkrPerGram * 100) / 100,
      usdPrice: Math.round(usdPerGram * 10000) / 10000,
      changePct: 0, // gold-api spot has no 24h delta
      source: "gold-api",
    });
  }
  return out;
}
