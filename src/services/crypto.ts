import { apiFetch } from "./api-url";
import type { MarketQuote } from "./psx-scraper";

export type CoinResult = { id: string; symbol: string; name: string };

export async function searchCoins(query: string): Promise<CoinResult[]> {
  const q = query.trim();
  if (!q) return [];
  const response = await apiFetch(`/api/crypto/search?q=${encodeURIComponent(q)}`);
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? (data as CoinResult[]) : [];
}

/** Fetch PKR-priced crypto quotes for CoinGecko ids. */
export async function fetchCryptoMarketData(coinIds: string[]): Promise<MarketQuote[]> {
  if (coinIds.length === 0) return [];
  const response = await apiFetch(
    `/api/crypto/market-data?ids=${coinIds.join(",")}`,
  );
  if (!response.ok) {
    throw new Error(`Crypto API returned ${response.status}`);
  }
  const data = await response.json();
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  return Array.isArray(data) ? (data as MarketQuote[]) : [];
}
