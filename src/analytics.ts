import { computeTwrIndex, type PortfolioSnapshot } from "./utils";

export type RiskMetrics = {
  /** false when there are fewer than 2 daily returns — UI shows "—". */
  ready: boolean;
  /** Most-negative peak-to-trough drawdown as a fraction, e.g. -0.072. */
  maxDrawdown: number;
  /** Annualized volatility (stdev of daily returns × √tradingDays), fraction. */
  volatilityAnnual: number;
  /** Annualized Sharpe ratio. 0 when volatility is 0. */
  sharpe: number;
  /** Best single-day TWR return, fraction. */
  bestDay: number;
  /** Worst single-day TWR return, fraction. */
  worstDay: number;
  /** Total TWR return over the window, fraction. */
  twrReturn: number;
  /** Annualized (CAGR-style) TWR return, fraction. */
  cagr: number;
  series: { twr: number[]; drawdown: number[]; dailyReturns: number[] };
};

const EMPTY: RiskMetrics = {
  ready: false,
  maxDrawdown: 0,
  volatilityAnnual: 0,
  sharpe: 0,
  bestDay: 0,
  worstDay: 0,
  twrReturn: 0,
  cagr: 0,
  series: { twr: [], drawdown: [], dailyReturns: [] },
};

/** Sample standard deviation (n-1). Returns 0 for fewer than 2 values. */
function sampleStdev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance =
    values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (n - 1);
  return Math.sqrt(variance);
}

/**
 * Risk analytics derived from the flow-adjusted TWR index, so deposits and
 * withdrawals between snapshots do not distort returns or volatility.
 */
export function computeRiskMetrics(
  snapshots: PortfolioSnapshot[],
  riskFree: number,
  tradingDays: number,
): RiskMetrics {
  const twr = computeTwrIndex(snapshots);
  if (twr.length < 2) return EMPTY;

  const dailyReturns: number[] = [];
  for (let i = 1; i < twr.length; i++) {
    const prev = twr[i - 1];
    if (prev <= 0) continue;
    dailyReturns.push(twr[i] / prev - 1);
  }

  // Drawdown vs running peak of the TWR index.
  const drawdown: number[] = [];
  let peak = twr[0];
  for (const v of twr) {
    if (v > peak) peak = v;
    drawdown.push(peak > 0 ? v / peak - 1 : 0);
  }
  const maxDrawdown = Math.min(0, ...drawdown);

  const volatilityAnnual = sampleStdev(dailyReturns) * Math.sqrt(tradingDays);

  const twrReturn = twr[twr.length - 1] / 100 - 1;
  const periods = dailyReturns.length;
  const cagr =
    periods > 0 && 1 + twrReturn > 0
      ? Math.pow(1 + twrReturn, tradingDays / periods) - 1
      : 0;

  const sharpe = volatilityAnnual > 0 ? (cagr - riskFree) / volatilityAnnual : 0;

  const bestDay = dailyReturns.length ? Math.max(...dailyReturns) : 0;
  const worstDay = dailyReturns.length ? Math.min(...dailyReturns) : 0;

  return {
    ready: dailyReturns.length >= 2,
    maxDrawdown,
    volatilityAnnual,
    sharpe,
    bestDay,
    worstDay,
    twrReturn,
    cagr,
    series: { twr, drawdown, dailyReturns },
  };
}
