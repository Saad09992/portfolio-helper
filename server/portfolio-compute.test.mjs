import { describe, expect, it } from "vitest";
import {
  computeTotals,
  pkDateOf,
  pkParts,
  psxCloseStatus,
  upsertDailySnapshot,
} from "./portfolio-compute.mjs";

describe("computeTotals", () => {
  it("returns zeros for empty input", () => {
    expect(computeTotals([])).toEqual({
      totalValue: 0,
      totalCost: 0,
      totalGainLoss: 0,
    });
  });

  it("sums non-cash holdings by shares * price/costBasis", () => {
    const r = computeTotals([
      { id: "h1", ticker: "A", shares: 10, price: 100, costBasis: 80 },
      { id: "h2", ticker: "B", shares: 5, price: 200, costBasis: 250 },
    ]);
    expect(r.totalValue).toBe(10 * 100 + 5 * 200);
    expect(r.totalCost).toBe(10 * 80 + 5 * 250);
    expect(r.totalGainLoss).toBe(r.totalValue - r.totalCost);
  });

  it("skips cash- ids in holdings list", () => {
    const r = computeTotals([
      { id: "cash-available", ticker: "CASH", shares: 1, price: 5000, costBasis: 5000 },
      { id: "h1", ticker: "A", shares: 1, price: 100, costBasis: 50 },
    ]);
    expect(r.totalValue).toBe(100);
    expect(r.totalCost).toBe(50);
  });

  it("adds cashAvailable to both totals so gainLoss is unchanged", () => {
    const r = computeTotals(
      [{ id: "h1", ticker: "A", shares: 2, price: 100, costBasis: 75 }],
      1000,
    );
    expect(r.totalValue).toBe(200 + 1000);
    expect(r.totalCost).toBe(150 + 1000);
    expect(r.totalGainLoss).toBe(50);
  });

  it("treats non-finite share/price/cost as zero", () => {
    const r = computeTotals([
      { id: "h1", ticker: "A", shares: "bogus", price: NaN, costBasis: undefined },
    ]);
    expect(r).toEqual({ totalValue: 0, totalCost: 0, totalGainLoss: 0 });
  });
});

describe("upsertDailySnapshot", () => {
  const sameDay = (iso) => iso.slice(0, 10);

  it("appends when no entry for that day exists", () => {
    const hist = [{ date: "2026-06-08T11:00:00Z", totalValue: 1, totalCost: 1, gainLoss: 0 }];
    const next = upsertDailySnapshot(
      hist,
      { date: "2026-06-09T11:00:00Z", totalValue: 2, totalCost: 1, gainLoss: 1 },
      sameDay,
    );
    expect(next).toHaveLength(2);
    expect(next[1].date).toBe("2026-06-09T11:00:00Z");
  });

  it("replaces in place when an entry for the same day exists", () => {
    const hist = [
      { date: "2026-06-08T11:00:00Z", totalValue: 1, totalCost: 1, gainLoss: 0 },
      { date: "2026-06-09T11:00:00Z", totalValue: 5, totalCost: 4, gainLoss: 1 },
    ];
    const next = upsertDailySnapshot(
      hist,
      { date: "2026-06-09T15:35:00Z", totalValue: 7, totalCost: 4, gainLoss: 3 },
      sameDay,
    );
    expect(next).toHaveLength(2);
    expect(next[1].totalValue).toBe(7);
    expect(next[1].date).toBe("2026-06-09T15:35:00Z");
  });

  it("caps at maxLen when appending", () => {
    const hist = Array.from({ length: 3 }, (_, i) => ({
      date: `2026-06-0${i + 1}T11:00:00Z`,
      totalValue: i,
      totalCost: i,
      gainLoss: 0,
    }));
    const next = upsertDailySnapshot(
      hist,
      { date: "2026-06-09T11:00:00Z", totalValue: 9, totalCost: 9, gainLoss: 0 },
      sameDay,
      3,
    );
    expect(next).toHaveLength(3);
    expect(next[0].date).toBe("2026-06-02T11:00:00Z");
    expect(next[2].date).toBe("2026-06-09T11:00:00Z");
  });

  it("returns a new array reference even on replace", () => {
    const hist = [
      { date: "2026-06-09T11:00:00Z", totalValue: 1, totalCost: 1, gainLoss: 0 },
    ];
    const next = upsertDailySnapshot(
      hist,
      { date: "2026-06-09T15:00:00Z", totalValue: 2, totalCost: 1, gainLoss: 1 },
      sameDay,
    );
    expect(next).not.toBe(hist);
  });
});

describe("pkParts / psxCloseStatus / pkDateOf", () => {
  it("computes Karachi date for an instant just past midnight UTC", () => {
    // 2026-06-09 00:30 UTC = 2026-06-09 05:30 PKT (UTC+5)
    const p = pkParts(new Date("2026-06-09T00:30:00Z"));
    expect(p.date).toBe("2026-06-09");
    expect(p.hour).toBe(5);
    expect(p.minute).toBe(30);
  });

  it("computes Karachi date for an instant late UTC night that's already next-day PKT", () => {
    // 2026-06-08 20:00 UTC = 2026-06-09 01:00 PKT
    const p = pkParts(new Date("2026-06-08T20:00:00Z"));
    expect(p.date).toBe("2026-06-09");
    expect(p.hour).toBe(1);
  });

  it("psxCloseStatus flags afterClose at 15:30 PKT", () => {
    // 2026-06-09 10:30 UTC = 2026-06-09 15:30 PKT (Tuesday)
    const s = psxCloseStatus(new Date("2026-06-09T10:30:00Z"));
    expect(s.afterClose).toBe(true);
    expect(s.isWeekday).toBe(true);
    expect(s.pkDate).toBe("2026-06-09");
  });

  it("psxCloseStatus flags before close at 15:29 PKT", () => {
    // 2026-06-09 10:29 UTC = 2026-06-09 15:29 PKT
    const s = psxCloseStatus(new Date("2026-06-09T10:29:00Z"));
    expect(s.afterClose).toBe(false);
  });

  it("psxCloseStatus flags weekend", () => {
    // 2026-06-13 is a Saturday
    const s = psxCloseStatus(new Date("2026-06-13T11:00:00Z"));
    expect(s.isWeekday).toBe(false);
  });

  it("pkDateOf strips to PKT calendar date", () => {
    expect(pkDateOf("2026-06-08T20:00:00Z")).toBe("2026-06-09");
    expect(pkDateOf("2026-06-09T05:00:00Z")).toBe("2026-06-09");
  });

  it("pkDateOf handles bad input by slicing first 10 chars", () => {
    expect(pkDateOf("not-a-date-with-extra")).toBe("not-a-date");
  });
});
