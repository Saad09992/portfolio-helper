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

export function parseHoldingsCsv(text: string): Holding[] {
  const rows = text.trim().split(/\r?\n/).filter(Boolean);

  if (rows.length < 2) {
    return [];
  }

  const headers = parseCsvRow(rows[0]).map((header) => header.toLowerCase());

  return rows.slice(1).map((row) => {
    const values = parseCsvRow(row);
    const record = new Map<string, string>();

    headers.forEach((header, index) => {
      record.set(header, values[index] ?? "");
    });

    return {
      id: createId(),
      ticker: normalizeText(record.get("ticker") ?? ""),
      name: normalizeText(record.get("name") ?? record.get("company") ?? ""),
      sector: normalizeText(record.get("sector") ?? "Uncategorized"),
      account: normalizeText(record.get("account") ?? "PSX"),
      shares: toNumber(record.get("shares") ?? "0"),
      price: toNumber(record.get("currentprice") ?? record.get("price") ?? "0"),
      costBasis: toNumber(
        record.get("avgprice") ??
          record.get("costbasis") ??
          record.get("cost") ??
          "0",
      ),
      dayChangePct: toNumber(
        record.get("daychangepct") ?? record.get("dailychange") ?? "0",
      ),
      dividendPerShare: toNumber(
        record.get("dividendpershare") ??
          record.get("annualdividendpershare") ??
          "0",
      ),
      payoutDate: normalizeText(record.get("payoutdate") ?? ""),
    } satisfies Holding;
  });
}

function parseCsvRow(row: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];

    if (character === '"') {
      if (inQuotes && row[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
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
