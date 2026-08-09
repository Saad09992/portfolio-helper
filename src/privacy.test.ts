import { afterEach, describe, expect, it } from "vitest";
import {
  COMPACT_MONEY_MASK,
  MONEY_MASK,
  isMoneyHidden,
  setMoneyHidden,
} from "./privacy";
import {
  formatCompactCurrency,
  formatCompactCurrencyRaw,
  formatCurrency,
  formatCurrencyRaw,
  formatPercent,
  formatSignedPercent,
} from "./utils";
import { buildPortfolioSummary, type PortfolioSummaryInput } from "./portfolio/summary";

// Module state: every case must put it back or the next one inherits it.
afterEach(() => setMoneyHidden(false));

const input: PortfolioSummaryInput = {
  generatedAt: "2026-06-12T10:00:00Z",
  lastFetchedAt: null,
  totals: {
    totalValue: 530_000_000,
    equityMarketValue: 500_000_000,
    totalCost: 480_000_000,
    unrealizedPnL: 20_000_000,
    dayPnL: 1_234_500,
  },
  cash: { available: 30_000_000, weight: 0.06 },
  holdings: [],
  sectors: [],
  targets: [],
  upcomingDividends: [],
  investments: { totalInvested: 0, latestValue: 0, pnlValue: 0, pnlPct: 0, count: 0 },
  investmentLedger: [],
  history: [],
  twrLatest: null,
};

describe("hidden mode", () => {
  it("is off until something turns it on", () => {
    expect(isMoneyHidden()).toBe(false);
    expect(formatCurrency(530_000_000)).toContain("5,300,000");
  });

  it("masks both money formatters", () => {
    setMoneyHidden(true);
    expect(formatCurrency(530_000_000)).toBe(MONEY_MASK);
    expect(formatCompactCurrency(530_000_000)).toBe(COMPACT_MONEY_MASK);
  });

  it("leaks no digits through the mask", () => {
    setMoneyHidden(true);
    for (const paisa of [0, 1, -1, 99, 530_000_000, -530_000_000]) {
      expect(formatCurrency(paisa)).not.toMatch(/\d/);
      expect(formatCompactCurrency(paisa)).not.toMatch(/\d/);
    }
  });

  /**
   * The whole point of masking rupees rather than every number: the shape of
   * the portfolio stays readable to its owner.
   */
  it("leaves percentages alone", () => {
    setMoneyHidden(true);
    expect(formatPercent(0.084)).toBe("8.4%");
    expect(formatSignedPercent(8.4, 1)).toBe("+8.4%");
  });

  it("never masks the raw formatters", () => {
    setMoneyHidden(true);
    expect(formatCurrencyRaw(530_000_000)).toContain("5,300,000");
    expect(formatCompactCurrencyRaw(530_000_000)).toBe("Rs 53.00 L");
  });

  /**
   * The clipboard is for you, not for the room. A summary that came out masked
   * would look complete and be useless — worse than not copying at all.
   */
  it("copies the real figures even while hidden", () => {
    setMoneyHidden(true);
    const md = buildPortfolioSummary(input, "headline");
    expect(md).toContain("5,300,000");
    expect(md).not.toContain(MONEY_MASK);
    expect(md).not.toContain("••");
  });

  it("restores the real figures when switched back off", () => {
    setMoneyHidden(true);
    setMoneyHidden(false);
    expect(formatCurrency(530_000_000)).toContain("5,300,000");
  });
});
