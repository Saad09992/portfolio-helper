import type { DerivedHolding, Holding } from "./types";

export const storageKey = "psx-portfolio-tools:v1";

export const sampleHoldings: Holding[] = [
  {
    id: "1",
    ticker: "OGDC",
    name: "Oil & Gas Development Co.",
    sector: "Energy",
    account: "PSX",
    shares: 1200,
    price: 146.2,
    costBasis: 128.4,
    dayChangePct: 1.2,
    dividendPerShare: 10.5,
    payoutDate: "2026-06-21",
  },
  {
    id: "2",
    ticker: "HBL",
    name: "Habib Bank Ltd.",
    sector: "Financials",
    account: "PSX",
    shares: 800,
    price: 153.75,
    costBasis: 141.1,
    dayChangePct: -0.4,
    dividendPerShare: 9.25,
    payoutDate: "2026-05-28",
  },
  {
    id: "3",
    ticker: "LUCK",
    name: "Lucky Cement",
    sector: "Materials",
    account: "PSX",
    shares: 310,
    price: 888.5,
    costBasis: 840.25,
    dayChangePct: 0.7,
    dividendPerShare: 24,
    payoutDate: "2026-07-03",
  },
  {
    id: "4",
    ticker: "SYS",
    name: "Systems Ltd.",
    sector: "Technology",
    account: "PSX",
    shares: 450,
    price: 462.8,
    costBasis: 401.9,
    dayChangePct: 2.6,
    dividendPerShare: 5.1,
    payoutDate: "2026-06-12",
  },
  {
    id: "5",
    ticker: "KEL",
    name: "K-Electric",
    sector: "Utilities",
    account: "PSX",
    shares: 5000,
    price: 4.92,
    costBasis: 4.28,
    dayChangePct: -1.1,
    dividendPerShare: 0.35,
    payoutDate: "2026-08-15",
  },
];

export function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Math.random().toString(36).slice(2, 10)}`
  );
}

export function normalizeText(value: string): string {
  return value.trim();
}

export function toNumber(value: string): number {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function computePortfolio(holdings: Holding[]): {
  holdings: DerivedHolding[];
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
} {
  const derived = holdings.map((holding) => ({
    ...holding,
    marketValue: holding.shares * holding.price,
    costValue: holding.shares * holding.costBasis,
    gainLoss: holding.shares * (holding.price - holding.costBasis),
    weight: 0,
  }));

  const totalValue = derived.reduce(
    (sum, holding) => sum + holding.marketValue,
    0,
  );
  const totalCost = derived.reduce(
    (sum, holding) => sum + holding.costValue,
    0,
  );
  const totalGainLoss = totalValue - totalCost;

  const withWeights = derived.map((holding) => ({
    ...holding,
    weight: totalValue > 0 ? holding.marketValue / totalValue : 0,
  }));

  return { holdings: withWeights, totalValue, totalCost, totalGainLoss };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace("PKR", "Rs");
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}Rs ${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}Rs ${(abs / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${sign}Rs ${(abs / 1e3).toFixed(1)}K`;
  return `${sign}Rs ${abs.toFixed(0)}`;
}

export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export function formatSignedPercent(value: number, dp = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(dp)}%`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(5, 10);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDateShort(iso);
}

export type TwrSnapshot = {
  totalValue: number;
  totalCost: number;
};

export function computeTwrIndex(snapshots: TwrSnapshot[]): number[] {
  if (snapshots.length === 0) return [];
  const index: number[] = [100];
  for (let i = 1; i < snapshots.length; i++) {
    const v0 = snapshots[i - 1].totalValue;
    const v1 = snapshots[i].totalValue;
    const costFlow = snapshots[i].totalCost - snapshots[i - 1].totalCost;
    if (v0 <= 0) {
      index.push(index[i - 1]);
      continue;
    }
    const adjustedV1 = v1 - costFlow;
    const r = adjustedV1 / v0 - 1;
    const next = index[i - 1] * (1 + r);
    index.push(Number.isFinite(next) ? next : index[i - 1]);
  }
  return index;
}

export type XirrFlow = { date: Date; amount: number };

export function xirr(flows: XirrFlow[], guess = 0.1): number {
  if (flows.length < 2) return 0;
  const hasNeg = flows.some((f) => f.amount < 0);
  const hasPos = flows.some((f) => f.amount > 0);
  if (!hasNeg || !hasPos) return 0;

  const t0 = flows[0].date.getTime();
  const years = flows.map(
    (f) => (f.date.getTime() - t0) / (365.25 * 86400 * 1000),
  );

  const npv = (r: number): number => {
    let sum = 0;
    for (let i = 0; i < flows.length; i++) {
      sum += flows[i].amount / Math.pow(1 + r, years[i]);
    }
    return sum;
  };

  const dnpv = (r: number): number => {
    let sum = 0;
    for (let i = 0; i < flows.length; i++) {
      sum -= (years[i] * flows[i].amount) / Math.pow(1 + r, years[i] + 1);
    }
    return sum;
  };

  let r = guess;
  for (let i = 0; i < 80; i++) {
    const v = npv(r);
    const d = dnpv(r);
    if (Math.abs(d) < 1e-12) break;
    const next = r - v / d;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - r) < 1e-9) return next;
    r = next;
    if (r < -0.999) r = -0.999;
  }
  return Number.isFinite(r) ? r : 0;
}

export function trailingTwelveMonthDividend(
  payouts: { date: string; amount: number }[],
  referenceDate: Date = new Date(),
): number {
  const cutoff = referenceDate.getTime() - 365 * 86400 * 1000;
  let sum = 0;
  for (const p of payouts) {
    const t = new Date(p.date).getTime();
    if (Number.isFinite(t) && t >= cutoff && t <= referenceDate.getTime()) {
      sum += p.amount;
    }
  }
  return sum;
}
