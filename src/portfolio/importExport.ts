import type { Holding } from "../types";
import type { PortfolioSnapshot } from "../utils";
import { rupeesToPaisa } from "../money";

// Schema version at/after which money fields are already integer paisa.
// Files below this (or with no version — legacy v1 exports) hold rupee-floats
// and are upconverted on import.
const PAISA_SCHEMA_VERSION = 2;

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

  // Legacy (rupee-float) files → upconvert money fields to integer paisa.
  // targetWeight, thresholds, dayChangePct, shares and kse100 are not money.
  const version = typeof data.version === "number" ? data.version : 1;
  if (version < PAISA_SCHEMA_VERSION) {
    return {
      holdings: holdings
        ? holdings.map((h) => ({
            ...h,
            price: rupeesToPaisa(h.price),
            costBasis: rupeesToPaisa(h.costBasis),
            dividendPerShare: rupeesToPaisa(h.dividendPerShare),
            payouts: Array.isArray(h.payouts)
              ? h.payouts.map((p) => ({
                  ...p,
                  dividendPerShare: rupeesToPaisa(p.dividendPerShare),
                }))
              : h.payouts,
          }))
        : null,
      cash: cash ? { available: rupeesToPaisa(cash.available) } : null,
      targets,
      investments: investments
        ? investments.map((iv) => ({
            ...iv,
            amount: rupeesToPaisa(iv.amount),
            valueEom: rupeesToPaisa(iv.valueEom),
          }))
        : null,
      history: history
        ? history.map((e) => ({
            ...e,
            totalValue: rupeesToPaisa(e.totalValue),
            totalCost: rupeesToPaisa(e.totalCost),
            gainLoss: rupeesToPaisa(e.gainLoss),
          }))
        : null,
      lastFetchedAt,
      exportedAt,
    };
  }

  return { holdings, cash, targets, investments, history, lastFetchedAt, exportedAt };
}
