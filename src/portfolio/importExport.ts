import type { Holding } from "../types";
import type { PortfolioSnapshot } from "../utils";

export type CashBuckets = { available: number };

export type ImportedTarget = {
  id: string;
  mode: "sector" | "ticker";
  key: string;
  targetWeight: number;
};

export type ImportedInvestment = {
  id: string;
  date: string;
  amount: number;
  valueEom: number;
  note?: string;
};

export type ImportBundle = {
  holdings: Holding[] | null;
  cash: CashBuckets | null;
  targets: ImportedTarget[] | null;
  investments: ImportedInvestment[] | null;
  history: PortfolioSnapshot[] | null;
  lastFetchedAt: string | null;
  exportedAt: string | null;
};

export class ImportParseError extends Error {}

export function parseImportBundle(raw: unknown): ImportBundle {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ImportParseError("Not a JSON object");
  }
  const data = raw as Record<string, unknown>;

  const holdings = Array.isArray(data.holdings) ? (data.holdings as Holding[]) : null;
  const cash =
    data.cash && typeof data.cash === "object" && !Array.isArray(data.cash)
      ? (data.cash as CashBuckets)
      : null;
  const targets = Array.isArray(data.targets) ? (data.targets as ImportedTarget[]) : null;
  const investments = Array.isArray(data.investments)
    ? (data.investments as ImportedInvestment[])
    : null;
  const history = Array.isArray(data.history) ? (data.history as PortfolioSnapshot[]) : null;
  const lastFetchedAt = typeof data.lastFetchedAt === "string" ? data.lastFetchedAt : null;
  const exportedAt = typeof data.exportedAt === "string" ? data.exportedAt : null;

  const anyData = holdings || cash || targets || investments || history;
  if (!anyData) {
    throw new ImportParseError("No recognizable portfolio data");
  }

  return { holdings, cash, targets, investments, history, lastFetchedAt, exportedAt };
}
