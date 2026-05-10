import type { Holding } from "../types";

export type MarketQuote = {
  ticker: string;
  ldcp: number;
  open: number;
  high: number;
  low: number;
  current: number;
  change: number;
  changePct: number;
  volume: number;
};

type DividendInfo = {
  ticker: string;
  dividendPerShare: number;
  payoutDate: string;
};

export async function fetchMarketData(): Promise<MarketQuote[]> {
  const response = await fetch("/api/psx/market-data");

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
    `/api/psx/dividends?tickers=${tickers.join(",")}`,
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
      }),
    };
  });

  return { holdings: updated, matched };
}
