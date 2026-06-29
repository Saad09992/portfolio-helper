import { describe, it, expect } from "vitest";
import { computeRiskMetrics, computeSavingsStats } from "./analytics";
import type { InvestmentRow } from "./derivedTypes";
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

function invRow(date: string, amount: number, total: number, valueEom: number): InvestmentRow {
  const pnlValue = valueEom - total;
  return {
    id: date,
    date,
    label: date,
    amount,
    valueEom,
    total,
    pnlValue,
    pnlPct: total > 0 ? (pnlValue / total) * 100 : 0,
  };
}

describe("computeSavingsStats", () => {
  it("is not ready with fewer than 2 rows", () => {
    expect(computeSavingsStats([]).ready).toBe(false);
    expect(computeSavingsStats([invRow("2026-01-01", 100, 100, 100)]).ready).toBe(false);
  });

  it("computes deposit-vs-market attribution and streak", () => {
    const rows = [
      invRow("2026-01-01", 100, 100, 100),
      invRow("2026-02-01", 100, 200, 230),
      invRow("2026-03-01", 100, 300, 400),
    ];
    const s = computeSavingsStats(rows);
    expect(s.ready).toBe(true);
    expect(s.totalContributed).toBe(300);
    expect(s.latestValue).toBe(400);
    expect(s.marketGain).toBe(100);
    expect(s.pctFromDeposits).toBeCloseTo(0.75, 6);
    expect(s.pctFromMarket).toBeCloseTo(0.25, 6);
    expect(s.streak).toBe(3);
  });

  it("streak resets on a non-positive contribution", () => {
    const rows = [
      invRow("2026-01-01", 100, 100, 100),
      invRow("2026-02-01", 0, 100, 120),
      invRow("2026-03-01", 50, 150, 200),
    ];
    expect(computeSavingsStats(rows).streak).toBe(1);
  });
});

import { computeBenchmarkStats } from "./analytics";

function snapK(date: string, totalValue: number, totalCost: number, kse100: number): PortfolioSnapshot {
  return { date, totalValue, totalCost, gainLoss: totalValue - totalCost, kse100 };
}

describe("computeBenchmarkStats", () => {
  it("not ready with fewer than 3 kse-tagged snapshots", () => {
    expect(computeBenchmarkStats([]).ready).toBe(false);
    expect(computeBenchmarkStats([snapK("2026-01-01", 100, 100, 1000)]).ready).toBe(false);
  });

  it("computes alpha as portfolio minus benchmark return (no flows)", () => {
    const snaps = [
      snapK("2026-01-01", 100, 100, 1000),
      snapK("2026-01-02", 110, 100, 1050),
      snapK("2026-01-03", 120, 100, 1100),
    ];
    const b = computeBenchmarkStats(snaps);
    expect(b.ready).toBe(true);
    expect(b.portReturn).toBeCloseTo(0.2, 6); // 100 -> 120
    expect(b.benchReturn).toBeCloseTo(0.1, 6); // 1000 -> 1100
    expect(b.alpha).toBeCloseTo(0.1, 6);
    expect(Number.isFinite(b.beta)).toBe(true);
  });

  it("beta ~1 when portfolio tracks the index 1:1", () => {
    const snaps = [
      snapK("2026-01-01", 1000, 1000, 1000),
      snapK("2026-01-02", 1010, 1000, 1010),
      snapK("2026-01-03", 1005, 1000, 1005),
      snapK("2026-01-04", 1030, 1000, 1030),
    ];
    expect(computeBenchmarkStats(snaps).beta).toBeCloseTo(1, 2);
  });
});
