import type { Holding, Payout } from "../types";
import { apiFetch } from "./api-url";
import { rupeesToPaisa } from "../money";

export type QuoteSource = "dps" | "sarmaaya" | string;

export type MarketQuote = {
  ticker: string;
  current: number;
  changePct: number;
  source?: QuoteSource;
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

export function applyMarketData(
  holdings: Holding[],
  quotes: MarketQuote[],
  dividends: DividendInfo[],
): { holdings: Holding[]; matched: number; sources: HoldingSources } {
  const byTicker = new Map<string, MarketQuote>();
  for (const quote of quotes) {
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

    const quote = byTicker.get(holding.ticker.toUpperCase());
    if (!quote) return holding;

    matched++;
    const div = divMap.get(holding.ticker.toUpperCase());

    sources[holding.ticker.toUpperCase()] = {
      price: quote.source,
      dividend: div?.source,
    };

    return {
      ...holding,
      // Scraped prices/dividends arrive in rupees → store as integer paisa.
      price: rupeesToPaisa(quote.current),
      dayChangePct: Math.round(quote.changePct * 100) / 100,
      ...(div && {
        dividendPerShare: rupeesToPaisa(div.dividendPerShare),
        payoutDate: div.payoutDate,
        payouts: (div.payouts ?? []).map((p) => ({
          ...p,
          dividendPerShare: rupeesToPaisa(p.dividendPerShare),
        })),
      }),
    };
  });

  return { holdings: updated, matched, sources };
}
