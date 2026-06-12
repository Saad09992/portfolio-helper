import type {
  CashBuckets,
  Holding,
  InvestmentEntry,
  TargetAllocation,
} from "../types";
import {
  type PortfolioSnapshot,
  sampleHoldings,
  storageKey,
} from "../utils";
import { normalizeHolding } from "./holdings";

export const cashStorageKey = `${storageKey}:cash-buckets`;
export const targetStorageKey = `${storageKey}:targets`;
export const investStorageKey = `${storageKey}:investments`;
export const historyStorageKey = `${storageKey}:history`;
export const lastFetchedStorageKey = `${storageKey}:last-fetched`;

export const emptyCashBuckets: CashBuckets = { available: 0 };

export function loadHoldings(): Holding[] {
  if (typeof window === "undefined") {
    return sampleHoldings.map(normalizeHolding);
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return sampleHoldings.map(normalizeHolding);
  }

  try {
    const parsed = JSON.parse(raw) as Holding[];
    return Array.isArray(parsed)
      ? parsed.map(normalizeHolding)
      : sampleHoldings.map(normalizeHolding);
  } catch {
    return sampleHoldings.map(normalizeHolding);
  }
}

export function loadCashBuckets(): CashBuckets {
  if (typeof window === "undefined") return emptyCashBuckets;

  const raw = window.localStorage.getItem(cashStorageKey);
  if (!raw) return emptyCashBuckets;

  try {
    const parsed = JSON.parse(raw) as Partial<CashBuckets>;
    return { available: Number(parsed.available ?? 0) };
  } catch {
    return emptyCashBuckets;
  }
}

export function loadTargets(): TargetAllocation[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(targetStorageKey);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as TargetAllocation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadInvestments(): InvestmentEntry[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(investStorageKey);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as InvestmentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadLastFetchedAt(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(lastFetchedStorageKey);
  return raw && raw !== "null" ? raw : null;
}

export function loadHistory(): PortfolioSnapshot[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(historyStorageKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PortfolioSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
