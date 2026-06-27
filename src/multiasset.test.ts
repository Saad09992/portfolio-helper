import { describe, it, expect } from "vitest";
import { buildAssetClassBuckets } from "./portfolio/holdings";
import { applyMarketData, type MarketQuote } from "./services/psx-scraper";
import type { Holding } from "./types";

function holding(p: Partial<Holding>): Holding {
  return {
    id: p.id ?? "h",
    ticker: p.ticker ?? "X",
    name: p.name ?? "X",
    sector: p.sector ?? "Uncategorized",
    account: p.account ?? "PSX",
    shares: p.shares ?? 1,
    price: p.price ?? 0,
    costBasis: p.costBasis ?? 0,
    dayChangePct: 0,
    dividendPerShare: 0,
    payoutDate: "",
    assetClass: p.assetClass,
    coinId: p.coinId,
  };
}

describe("buildAssetClassBuckets", () => {
  it("groups stock/crypto/cash and sorts by value", () => {
    const buckets = buildAssetClassBuckets([
      { id: "s1", assetClass: "stock", marketValue: 100, weight: 0.5 },
      { id: "c1", assetClass: "crypto", marketValue: 60, weight: 0.3 },
      { id: "cash-available", assetClass: "stock", marketValue: 40, weight: 0.2 },
    ]);
    expect(buckets.map((b) => b.assetClass)).toEqual(["stock", "crypto", "cash"]);
    expect(buckets[0]).toMatchObject({ assetClass: "stock", value: 100, holdings: 1 });
    expect(buckets.find((b) => b.assetClass === "cash")?.value).toBe(40);
  });
});

describe("applyMarketData multi-asset matching", () => {
  it("matches stocks by ticker and crypto by coinId, sets usdPrice", () => {
    const holdings = [
      holding({ id: "s", ticker: "MEBL", assetClass: "stock", shares: 10 }),
      holding({ id: "c", ticker: "BTC", assetClass: "crypto", coinId: "bitcoin", shares: 2 }),
    ];
    const quotes: MarketQuote[] = [
      { ticker: "MEBL", current: 300, changePct: 1, source: "dps" },
      { ticker: "", coinId: "bitcoin", current: 16_000_000, usdPrice: 60000, changePct: 2, source: "coingecko" },
    ];
    const { holdings: out, matched, sources } = applyMarketData(holdings, quotes, []);
    expect(matched).toBe(2);
    expect(out[0].price).toBe(300);
    expect(out[1].price).toBe(16_000_000);
    expect(out[1].usdPrice).toBe(60000);
    expect(out[1].dayChangePct).toBe(2);
    expect(sources["BTC"].price).toBe("coingecko");
  });

  it("does not match a crypto holding lacking a coinId", () => {
    const holdings = [holding({ id: "c", ticker: "BTC", assetClass: "crypto", coinId: "" })];
    const quotes: MarketQuote[] = [
      { ticker: "", coinId: "bitcoin", current: 1, changePct: 0, source: "coingecko" },
    ];
    expect(applyMarketData(holdings, quotes, []).matched).toBe(0);
  });
});
