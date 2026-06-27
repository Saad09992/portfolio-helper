import { describe, it, expect } from "vitest";
import { computeRiskMetrics } from "./analytics";
import type { PortfolioSnapshot } from "./utils";

const RF = 0.11;
const TD = 252;

function snap(date: string, totalValue: number, totalCost: number): PortfolioSnapshot {
  return { date, totalValue, totalCost, gainLoss: totalValue - totalCost };
}

describe("computeRiskMetrics", () => {
  it("returns not-ready with fewer than 2 daily returns", () => {
    const rm = computeRiskMetrics([snap("2026-01-01", 100, 100)], RF, TD);
    expect(rm.ready).toBe(false);
    expect(rm.maxDrawdown).toBe(0);
    expect(rm.volatilityAnnual).toBe(0);
    expect(rm.sharpe).toBe(0);
    expect(rm.series.twr).toEqual([]);
  });

  it("computes drawdown from a peak-then-dip series (no flows)", () => {
    // value: 100 -> 110 (peak) -> 99 -> 104. cost constant so TWR tracks value.
    const rm = computeRiskMetrics(
      [
        snap("2026-01-01", 100, 100),
        snap("2026-01-02", 110, 100),
        snap("2026-01-03", 99, 100),
        snap("2026-01-04", 104, 100),
      ],
      RF,
      TD,
    );
    expect(rm.ready).toBe(true);
    // trough 99 vs peak 110 => -10%
    expect(rm.maxDrawdown).toBeCloseTo(99 / 110 - 1, 6);
    // best daily return = +10% (100->110), worst = 99/110-1 = -10%
    expect(rm.bestDay).toBeCloseTo(0.1, 6);
    expect(rm.worstDay).toBeCloseTo(99 / 110 - 1, 6);
    // total TWR return = 104/100 - 1 = +4%
    expect(rm.twrReturn).toBeCloseTo(0.04, 6);
  });

  it("is flow-adjusted: a pure deposit must not register as a return", () => {
    // value jumps 100 -> 200 but cost also +100 (deposit), so TWR return = 0.
    const rm = computeRiskMetrics(
      [
        snap("2026-01-01", 100, 100),
        snap("2026-01-02", 200, 200),
        snap("2026-01-03", 200, 200),
      ],
      RF,
      TD,
    );
    expect(rm.twrReturn).toBeCloseTo(0, 6);
    expect(rm.maxDrawdown).toBeCloseTo(0, 6);
    expect(rm.bestDay).toBeCloseTo(0, 6);
  });

  it("computes positive annualized volatility for a fluctuating series", () => {
    const rm = computeRiskMetrics(
      [
        snap("2026-01-01", 100, 100),
        snap("2026-01-02", 105, 100),
        snap("2026-01-03", 98, 100),
        snap("2026-01-04", 107, 100),
        snap("2026-01-05", 101, 100),
      ],
      RF,
      TD,
    );
    expect(rm.volatilityAnnual).toBeGreaterThan(0);
    expect(Number.isFinite(rm.sharpe)).toBe(true);
    expect(rm.series.dailyReturns.length).toBe(4);
  });

  it("sharpe is 0 when volatility is 0 (flat returns)", () => {
    // constant value => zero daily returns => zero volatility.
    const rm = computeRiskMetrics(
      [
        snap("2026-01-01", 100, 100),
        snap("2026-01-02", 100, 100),
        snap("2026-01-03", 100, 100),
      ],
      RF,
      TD,
    );
    expect(rm.volatilityAnnual).toBe(0);
    expect(rm.sharpe).toBe(0);
  });
});
