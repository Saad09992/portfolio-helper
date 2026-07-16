import type { CashBuckets, Holding, SectorBucket } from "../types";

export function normalizeHolding(holding: Holding): Holding {
  return {
    ...holding,
    dayChangePct: Number(holding.dayChangePct ?? 0),
    dividendPerShare: Number(holding.dividendPerShare ?? 0),
    payoutDate: holding.payoutDate ?? "",
  };
}

export function buildHoldingsWithCash(
  holdings: Holding[],
  cash: CashBuckets,
): Holding[] {
  const nonCash = holdings.filter((holding) => !holding.id.startsWith("cash-"));

  if (cash.available <= 0) return nonCash;

  const cashPosition: Holding = {
    id: "cash-available",
    ticker: "CASH",
    name: "Available Cash",
    sector: "Cash",
    account: "Cash",
    shares: 1,
    price: cash.available,
    costBasis: cash.available,
    dayChangePct: 0,
    dividendPerShare: 0,
    payoutDate: "",
  };

  return [cashPosition, ...nonCash];
}

export function buildSectorBuckets(
  holdings: { sector: string; marketValue: number; weight: number }[],
): SectorBucket[] {
  const map = new Map<string, SectorBucket>();

  for (const holding of holdings) {
    const current = map.get(holding.sector) ?? {
      sector: holding.sector,
      value: 0,
      weight: 0,
      holdings: 0,
    };
    current.value += holding.marketValue;
    current.weight += holding.weight;
    current.holdings += 1;
    map.set(holding.sector, current);
  }

  return [...map.values()].sort((left, right) => right.value - left.value);
}

export function getCashDeploymentIdea(cashWeight: number): string {
  if (cashWeight >= 0.25) {
    return "Cash is above 25%. Consider deploying into underweight targets gradually.";
  }
  if (cashWeight >= 0.1) {
    return "Cash is healthy. Keep watchlist entries ready for pullbacks.";
  }
  return "Cash is tight. Prioritize trims from overweight targets before new buys.";
}
