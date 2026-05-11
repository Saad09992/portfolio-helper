import { describe, expect, it } from "vitest";
import {
  computeTwrIndex,
  formatCompactCurrency,
  formatDateShort,
  formatSignedPercent,
  trailingTwelveMonthDividend,
  xirr,
} from "./utils";

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

describe("xirr", () => {
  it("returns ~0% for matched in/out same-day flows", () => {
    const rate = xirr([
      { date: new Date("2025-01-01"), amount: -1000 },
      { date: new Date("2026-01-01"), amount: 1000 },
    ]);
    expect(Math.abs(rate)).toBeLessThan(0.01);
  });

  it("returns ~10% for 1000 grown to 1100 over one year", () => {
    const rate = xirr([
      { date: new Date("2025-01-01"), amount: -1000 },
      { date: new Date("2026-01-01"), amount: 1100 },
    ]);
    expect(rate).toBeCloseTo(0.1, 2);
  });

  it("handles multiple deposits", () => {
    const rate = xirr([
      { date: new Date("2025-01-01"), amount: -500 },
      { date: new Date("2025-07-01"), amount: -500 },
      { date: new Date("2026-01-01"), amount: 1100 },
    ]);
    expect(rate).toBeGreaterThan(0.05);
    expect(rate).toBeLessThan(0.25);
  });

  it("returns 0 when flows are single-sided", () => {
    expect(
      xirr([
        { date: new Date("2025-01-01"), amount: -100 },
        { date: new Date("2025-02-01"), amount: -100 },
      ]),
    ).toBe(0);
  });
});

describe("trailingTwelveMonthDividend", () => {
  it("sums only payouts within 365 days", () => {
    const ref = new Date("2026-05-11");
    const sum = trailingTwelveMonthDividend(
      [
        { date: "2024-01-15", amount: 50 }, // older than 1 year, excluded
        { date: "2025-06-01", amount: 10 },
        { date: "2026-01-10", amount: 20 },
        { date: "2026-04-20", amount: 30 },
      ],
      ref,
    );
    expect(sum).toBe(60);
  });

  it("returns 0 for empty list", () => {
    expect(trailingTwelveMonthDividend([])).toBe(0);
  });
});

describe("formatCompactCurrency", () => {
  it("formats under 1K as full rupees", () => {
    expect(formatCompactCurrency(847)).toBe("Rs 847");
  });

  it("formats thousands with K suffix", () => {
    expect(formatCompactCurrency(12500)).toBe("Rs 12.5K");
  });

  it("formats lakhs with L suffix", () => {
    expect(formatCompactCurrency(250000)).toBe("Rs 2.50 L");
  });

  it("formats crores with Cr suffix", () => {
    expect(formatCompactCurrency(50000000)).toBe("Rs 5.00 Cr");
  });

  it("preserves negative sign", () => {
    expect(formatCompactCurrency(-25000)).toBe("-Rs 25.0K");
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
