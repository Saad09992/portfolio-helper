import { apiFetch } from "./api-url";
import type { MarketQuote } from "./psx-scraper";

/**
 * Fetch precious-metal spot quotes, priced in PKR per gram (with native USD
 * per gram for the secondary label). Match key is `metalId` (gold/silver).
 */
export async function fetchMetalMarketData(metalIds: string[]): Promise<MarketQuote[]> {
  if (metalIds.length === 0) return [];
  const response = await apiFetch(
    `/api/metals/market-data?metals=${metalIds.join(",")}`,
  );
  if (!response.ok) {
    throw new Error(`Metals API returned ${response.status}`);
  }
  const data = await response.json();
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  return Array.isArray(data) ? (data as MarketQuote[]) : [];
}
