import { TARGET_DEFAULTS } from "../constants";
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

export function normalizeTarget(t: TargetAllocation): TargetAllocation {
  return {
    ...t,
    warnThreshold: t.warnThreshold ?? TARGET_DEFAULTS.WARN_THRESHOLD,
    criticalThreshold: t.criticalThreshold ?? TARGET_DEFAULTS.CRITICAL_THRESHOLD,
    cadence: t.cadence ?? TARGET_DEFAULTS.CADENCE,
    lastRebalancedAt: t.lastRebalancedAt ?? null,
  };
}

export const cashStorageKey = `${storageKey}:cash-buckets`;
export const targetStorageKey = `${storageKey}:targets`;
export const targetPresetStorageKey = `${storageKey}:target-presets`;
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
    return Array.isArray(parsed) ? parsed.map(normalizeTarget) : [];
  } catch {
    return [];
  }
}

export type TargetPreset = { name: string; targets: TargetAllocation[] };

export function loadTargetPresets(): TargetPreset[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(targetPresetStorageKey);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as TargetPreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.name === "string" && Array.isArray(p.targets))
      .map((p) => ({ name: p.name, targets: p.targets.map(normalizeTarget) }));
  } catch {
    return [];
  }
}

export function saveTargetPresets(presets: TargetPreset[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(targetPresetStorageKey, JSON.stringify(presets));
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
