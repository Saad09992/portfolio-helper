import { describe, expect, it } from "vitest";
import {
  computePortfolio,
  computeTwrIndex,
  formatCompactCurrency,
  formatDateShort,
  formatSignedPercent,
  upsertDailySnapshot,
} from "./utils";
import type { Holding } from "./types";

function holding(over: Partial<Holding>): Holding {
  return {
    id: "h",
    ticker: "X",
    name: "X",
    sector: "Misc",
    account: "PSX",
    shares: 0,
    price: 0,
    costBasis: 0,
    dayChangePct: 0,
    dividendPerShare: 0,
    payoutDate: "",
    ...over,
  };
}

describe("computePortfolio", () => {
  it("returns zeros for empty input", () => {
    const r = computePortfolio([]);
    expect(r.holdings).toEqual([]);
    expect(r.totalValue).toBe(0);
    expect(r.totalCost).toBe(0);
    expect(r.totalGainLoss).toBe(0);
  });

  it("computes marketValue, costValue, gainLoss for a single holding", () => {
    const r = computePortfolio([holding({ shares: 100, price: 150, costBasis: 120 })]);
    expect(r.holdings[0].marketValue).toBe(15_000);
    expect(r.holdings[0].costValue).toBe(12_000);
    expect(r.holdings[0].gainLoss).toBe(3_000);
    expect(r.holdings[0].weight).toBeCloseTo(1, 6);
    expect(r.totalGainLoss).toBe(3_000);
  });

  it("yields weight=0 for all when totalValue is 0 (no divide-by-zero)", () => {
    const r = computePortfolio([
      holding({ id: "a", shares: 0, price: 100, costBasis: 50 }),
      holding({ id: "b", shares: 0, price: 200, costBasis: 100 }),
    ]);
    expect(r.totalValue).toBe(0);
    expect(r.holdings.every((h) => h.weight === 0)).toBe(true);
    for (const h of r.holdings) expect(Number.isFinite(h.weight)).toBe(true);
  });

  it("weights sum to ~1 across multiple holdings", () => {
    const r = computePortfolio([
      holding({ id: "a", shares: 10, price: 100, costBasis: 90 }),
      holding({ id: "b", shares: 20, price: 50, costBasis: 60 }),
      holding({ id: "c", shares: 5, price: 200, costBasis: 200 }),
    ]);
    const sum = r.holdings.reduce((s, h) => s + h.weight, 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it("returns a negative totalGainLoss when price < costBasis", () => {
    const r = computePortfolio([holding({ shares: 100, price: 80, costBasis: 120 })]);
    expect(r.totalGainLoss).toBe(-4_000);
    expect(r.holdings[0].gainLoss).toBe(-4_000);
  });
});

describe("computeTwrIndex", () => {
  it("returns flat index when no value changes", () => {
    const idx = computeTwrIndex([
      { totalValue: 1000, totalCost: 1000 },
      { totalValue: 1000, totalCost: 1000 },
      { totalValue: 1000, totalCost: 1000 },
    ]);
    expect(idx).toEqual([100, 100, 100]);
  });

  it("detects 10% gain with no contributions", () => {
    const idx = computeTwrIndex([
      { totalValue: 1000, totalCost: 1000 },
      { totalValue: 1100, totalCost: 1000 },
    ]);
    expect(idx[1]).toBeCloseTo(110, 4);
  });

  it("ignores cost-flow contributions (deposits do not appear as return)", () => {
    const idx = computeTwrIndex([
      { totalValue: 1000, totalCost: 1000 },
      { totalValue: 2000, totalCost: 2000 }, // 1000 deposit, no market move
    ]);
    expect(idx[1]).toBeCloseTo(100, 4);
  });

  it("chains period returns correctly across deposit + gain", () => {
    const idx = computeTwrIndex([
      { totalValue: 1000, totalCost: 1000 },
      { totalValue: 2000, totalCost: 2000 }, // deposit only
      { totalValue: 2200, totalCost: 2000 }, // 10% market gain on 2000
    ]);
    expect(idx[2]).toBeCloseTo(110, 4);
  });
});

describe("upsertDailySnapshot", () => {
  const pkDateOf = (iso: string) => iso.slice(0, 10);
  const snap = (
    date: string,
    totalValue: number,
    totalCost = 1000,
    gainLoss = totalValue - totalCost,
  ) => ({ date, totalValue, totalCost, gainLoss });

  it("appends to empty history", () => {
    const entry = snap("2026-05-14T10:00:00Z", 1200);
    expect(upsertDailySnapshot([], entry, pkDateOf)).toEqual([entry]);
  });

  it("appends when the last entry is a different PKT day", () => {
    const history = [snap("2026-05-13T10:00:00Z", 1100)];
    const entry = snap("2026-05-14T10:00:00Z", 1200);
    const result = upsertDailySnapshot(history, entry, pkDateOf);
    expect(result).toHaveLength(2);
    expect(result[1]).toBe(entry);
    expect(result[0]).toBe(history[0]);
  });

  it("replaces in place when a snapshot for the same PKT day exists", () => {
    const history = [
      snap("2026-05-13T10:00:00Z", 1100),
      snap("2026-05-14T11:00:00Z", 1150),
    ];
    const entry = snap("2026-05-14T15:45:00Z", 1234);
    const result = upsertDailySnapshot(history, entry, pkDateOf);
    expect(result).toHaveLength(2);
    expect(result[1]).toBe(entry);
    expect(result[0]).toBe(history[0]);
    expect(result).not.toBe(history);
  });

  it("replaces the matching index even when it is not last", () => {
    const history = [
      snap("2026-05-14T09:00:00Z", 1150),
      snap("2026-05-15T10:00:00Z", 1300),
    ];
    const entry = snap("2026-05-14T16:00:00Z", 1199);
    const result = upsertDailySnapshot(history, entry, pkDateOf);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(entry);
    expect(result[1]).toBe(history[1]);
  });

  it("caps appended history at maxLen, dropping the oldest", () => {
    const dated = Array.from({ length: 365 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 0, 1) + i * 86400000);
      return snap(d.toISOString(), 1000 + i);
    });
    const entry = snap("2026-01-02T00:00:00Z", 9999);
    const result = upsertDailySnapshot(dated, entry, pkDateOf);
    expect(result).toHaveLength(365);
    expect(result[result.length - 1]).toBe(entry);
    expect(result[0]).toBe(dated[1]);
  });

  it("does not grow or trim when replacing within a full history", () => {
    const dated = Array.from({ length: 365 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 0, 1) + i * 86400000);
      return snap(d.toISOString(), 1000 + i);
    });
    const entry = snap(dated[dated.length - 1].date, 5555);
    const result = upsertDailySnapshot(dated, entry, pkDateOf);
    expect(result).toHaveLength(365);
    expect(result[result.length - 1]).toBe(entry);
    expect(result[0]).toBe(dated[0]);
  });

  it("latest refresh wins even when the new value is lower (stale-price fix)", () => {
    const history = [snap("2026-05-14T15:35:00Z", 5000)];
    const corrected = snap("2026-05-14T18:00:00Z", 4200);
    expect(upsertDailySnapshot(history, corrected, pkDateOf)).toEqual([
      corrected,
    ]);
  });

  it("preserves the shares dict on replacement", () => {
    const history = [
      { ...snap("2026-05-14T11:00:00Z", 1150), shares: { OGDC: 100 } },
    ];
    const entry = {
      ...snap("2026-05-14T15:45:00Z", 1234),
      shares: { OGDC: 105, PVOT: 20 },
    };
    const result = upsertDailySnapshot(history, entry, pkDateOf);
    expect(result).toHaveLength(1);
    expect(result[0].shares).toEqual({ OGDC: 105, PVOT: 20 });
  });
});



describe("formatCompactCurrency", () => {
  // Inputs are integer paisa (× 100 of the rupee amount shown).
  it("formats under 1K as full rupees", () => {
    expect(formatCompactCurrency(84_700)).toBe("Rs 847");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCompactCurrency(1_250_000)).toBe("Rs 12.5K");
  });

  it("formats lakhs with L suffix", () => {
    expect(formatCompactCurrency(25_000_000)).toBe("Rs 2.50 L");
  });

  it("formats crores with Cr suffix", () => {
    expect(formatCompactCurrency(5_000_000_000)).toBe("Rs 5.00 Cr");
  });

  it("preserves negative sign", () => {
    expect(formatCompactCurrency(-2_500_000)).toBe("-Rs 25.0K");
  });
});

describe("formatSignedPercent", () => {
  it("adds + for positive", () => {
    expect(formatSignedPercent(12.3)).toBe("+12.30%");
  });

  it("preserves - for negative", () => {
    expect(formatSignedPercent(-5)).toBe("-5.00%");
  });

  it("respects decimal precision arg", () => {
    expect(formatSignedPercent(1.234567, 4)).toBe("+1.2346%");
  });
});

describe("formatDateShort", () => {
  it("formats ISO to DD MMM", () => {
    expect(formatDateShort("2026-05-11T10:00:00Z")).toMatch(/May/);
  });

  it("falls back gracefully on bad input", () => {
    expect(formatDateShort("not-a-date")).toBe("-date");
  });
});
