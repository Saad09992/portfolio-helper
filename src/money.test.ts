import { describe, it, expect } from "vitest";
import { rupeesToPaisa, paisaToRupees, roundPaisa } from "./money";
import { computePortfolio } from "./utils";
import type { Holding } from "./types";

describe("money helpers", () => {
  it("rupeesToPaisa rounds to whole paisa", () => {
    expect(rupeesToPaisa(4.92)).toBe(492);
    expect(rupeesToPaisa(146.2)).toBe(14620);
    expect(rupeesToPaisa(0.1)).toBe(10);
    expect(rupeesToPaisa(0.005)).toBe(1); // rounds up at half-paisa
    expect(rupeesToPaisa(NaN)).toBe(0);
  });

  it("paisaToRupees is the inverse", () => {
    expect(paisaToRupees(492)).toBe(4.92);
    expect(paisaToRupees(14620)).toBe(146.2);
  });

  it("roundPaisa collapses fractional paisa from ratio math", () => {
    expect(roundPaisa(19607.84)).toBe(19608);
    expect(roundPaisa(100.4)).toBe(100);
    expect(roundPaisa(NaN)).toBe(0);
  });
});

describe("computePortfolio — integer-paisa exactness", () => {
  const holding = (over: Partial<Holding>): Holding => ({
    id: "x",
    ticker: "X",
    name: "X",
    sector: "S",
    account: "PSX",
    shares: 0,
    price: 0,
    costBasis: 0,
    dayChangePct: 0,
    dividendPerShare: 0,
    payoutDate: "",
    ...over,
  });

  it("penny stock: no float drift, exact integer paisa", () => {
    // ₨4.92 / ₨4.28 over 5000 shares — the classic float-drift case
    // (5000 * 4.92 === 24600.000000000004 in floats).
    const [h] = computePortfolio([
      holding({ shares: 5000, price: 492, costBasis: 428 }),
    ]).holdings;
    expect(h.marketValue).toBe(2_460_000); // ₨24,600.00
    expect(h.costValue).toBe(2_140_000); // ₨21,400.00
    expect(h.gainLoss).toBe(320_000); // ₨3,200.00
    expect(Number.isInteger(h.marketValue)).toBe(true);
    expect(Number.isInteger(h.gainLoss)).toBe(true);
  });

  it("totals over mixed holdings stay exact integers", () => {
    const { totalValue, totalCost, totalGainLoss } = computePortfolio([
      holding({ shares: 5000, price: 492, costBasis: 428 }),
      holding({ id: "y", shares: 1200, price: 14620, costBasis: 12840 }),
    ]);
    expect(totalValue).toBe(2_460_000 + 1200 * 14620);
    expect(totalCost).toBe(2_140_000 + 1200 * 12840);
    expect(totalGainLoss).toBe(totalValue - totalCost);
    expect(Number.isInteger(totalValue)).toBe(true);
  });
});
