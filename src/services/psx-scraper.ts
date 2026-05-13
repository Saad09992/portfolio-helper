import type { Holding, Payout } from "../types";
import { apiUrl } from "./api-url";

export type MarketQuote = {
  ticker: string;
  current: number;
  changePct: number;
};

type DividendInfo = {
  ticker: string;
  dividendPerShare: number;
  payoutDate: string;
  payouts?: Payout[];
};

export async function fetchMarketData(tickers: string[]): Promise<MarketQuote[]> {
  if (tickers.length === 0) return [];

  const response = await fetch(
    apiUrl(`/api/psx/market-data?tickers=${tickers.join(",")}`),
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

  const response = await fetch(
    apiUrl(`/api/psx/dividends?tickers=${tickers.join(",")}`),
  );

  if (!response.ok) return [];

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export function applyMarketData(
  holdings: Holding[],
  quotes: MarketQuote[],
  dividends: DividendInfo[],
): { holdings: Holding[]; matched: number } {
  const quoteMap = new Map<string, MarketQuote>();
  for (const quote of quotes) {
    quoteMap.set(quote.ticker, quote);
  }

  const divMap = new Map<string, DividendInfo>();
  for (const div of dividends) {
    divMap.set(div.ticker, div);
  }

  let matched = 0;

  const updated = holdings.map((holding) => {
    if (holding.id.startsWith("cash-")) return holding;

    const quote = quoteMap.get(holding.ticker.toUpperCase());
    if (!quote) return holding;

    matched++;
    const div = divMap.get(holding.ticker.toUpperCase());

    return {
      ...holding,
      price: Math.round(quote.current * 100) / 100,
      dayChangePct: Math.round(quote.changePct * 100) / 100,
      ...(div && {
        dividendPerShare: div.dividendPerShare,
        payoutDate: div.payoutDate,
        payouts: div.payouts ?? [],
      }),
    };
  });

  return { holdings: updated, matched };
}
