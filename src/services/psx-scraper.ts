import type { Holding, Payout } from "../types";
import { apiFetch } from "./api-url";

export type QuoteSource = "dps" | "sarmaaya" | "coingecko" | "gold-api" | string;

export type MarketQuote = {
  ticker: string;
  current: number;
  changePct: number;
  source?: QuoteSource;
  /** Set for crypto quotes — match key (stocks match by ticker). */
  coinId?: string;
  /** Set for metal quotes — match key (gold/silver). */
  metalId?: string;
  /** Native USD price (crypto: per-coin; metal: per-gram) for secondary label. */
  usdPrice?: number;
};

type DividendInfo = {
  ticker: string;
  dividendPerShare: number;
  payoutDate: string;
  payouts?: Payout[];
  source?: QuoteSource;
};

/** Per-ticker provenance of the latest refresh (non-persisted, for UI badges). */
export type HoldingSources = Record<
  string,
  { price?: QuoteSource; dividend?: QuoteSource }
>;

export async function fetchMarketData(tickers: string[]): Promise<MarketQuote[]> {
  if (tickers.length === 0) return [];

  const response = await apiFetch(
    `/api/psx/market-data?tickers=${tickers.join(",")}`,
  );

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  if (!Array.isArray(data)) {
    throw new Error("Unexpected response format");
  }

  return data as MarketQuote[];
}

export async function fetchDividends(tickers: string[]): Promise<DividendInfo[]> {
  if (tickers.length === 0) return [];

  const response = await apiFetch(
    `/api/psx/dividends?tickers=${tickers.join(",")}`,
  );

  if (!response.ok) {
    throw new Error(`Dividends API returned ${response.status}`);
  }

  const data = await response.json();
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  return Array.isArray(data) ? data : [];
}

export function applyMarketData(
  holdings: Holding[],
  quotes: MarketQuote[],
  dividends: DividendInfo[],
): { holdings: Holding[]; matched: number; sources: HoldingSources } {
  // Stocks match by ticker; crypto by CoinGecko id; metals by metalId.
  const byTicker = new Map<string, MarketQuote>();
  const byCoinId = new Map<string, MarketQuote>();
  const byMetalId = new Map<string, MarketQuote>();
  for (const quote of quotes) {
    if (quote.coinId) byCoinId.set(quote.coinId, quote);
    if (quote.metalId) byMetalId.set(quote.metalId, quote);
    if (quote.ticker) byTicker.set(quote.ticker.toUpperCase(), quote);
  }

  const divMap = new Map<string, DividendInfo>();
  for (const div of dividends) {
    divMap.set(div.ticker, div);
  }

  let matched = 0;
  const sources: HoldingSources = {};

  const updated = holdings.map((holding) => {
    if (holding.id.startsWith("cash-")) return holding;

    const isCrypto = holding.assetClass === "crypto";
    const isMetal = holding.assetClass === "metal";
    const quote = isCrypto
      ? holding.coinId
        ? byCoinId.get(holding.coinId)
        : undefined
      : isMetal
        ? holding.metalId
          ? byMetalId.get(holding.metalId)
          : undefined
        : byTicker.get(holding.ticker.toUpperCase());
    if (!quote) return holding;

    matched++;
    const div = isCrypto || isMetal ? undefined : divMap.get(holding.ticker.toUpperCase());

    sources[holding.ticker.toUpperCase()] = {
      price: quote.source,
      dividend: div?.source,
    };

    // Crypto is USD-native: keep the unified PKR math correct by deriving the
    // PKR cost basis from the USD cost via CoinGecko's implied USD->PKR rate
    // (price_pkr / price_usd). So PKR P/L == USD P/L converted at today's FX.
    let cryptoCostBasis: number | undefined;
    if (isCrypto && quote.usdPrice && quote.usdPrice > 0) {
      const rate = quote.current / quote.usdPrice;
      cryptoCostBasis = Math.round((holding.usdCostBasis ?? 0) * rate * 100) / 100;
    }

    return {
      ...holding,
      price: Math.round(quote.current * 100) / 100,
      dayChangePct: Math.round(quote.changePct * 100) / 100,
      ...(quote.usdPrice !== undefined && { usdPrice: quote.usdPrice }),
      ...(cryptoCostBasis !== undefined && { costBasis: cryptoCostBasis }),
      ...(div && {
        dividendPerShare: div.dividendPerShare,
        payoutDate: div.payoutDate,
        payouts: div.payouts ?? [],
      }),
    };
  });

  return { holdings: updated, matched, sources };
}
