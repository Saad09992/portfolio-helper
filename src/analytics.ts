import { computeTwrIndex, type PortfolioSnapshot } from "./utils";
import type { InvestmentRow } from "./derivedTypes";

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

export type SavingsStats = {
  ready: boolean;
  /** Average monthly contribution (sum of positive deposits / months elapsed). */
  monthlyAvg: number;
  /** Net capital contributed (last cumulative total). */
  totalContributed: number;
  /** Value as of the last Invest-tab entry (its `valueEom`), not live prices. */
  latestValue: number;
  marketGain: number;
  /** Share of current value attributable to deposits vs market gains. */
  pctFromDeposits: number;
  pctFromMarket: number;
  /** Date of the entry `latestValue`/`marketGain` come from (ISO, "" when none). */
  latestValueDate: string;
  /** True when a live portfolio value was supplied and the live split is usable. */
  liveReady: boolean;
  /** Portfolio value at live prices (0 when not supplied). */
  liveValue: number;
  liveMarketGain: number;
  livePctFromDeposits: number;
  livePctFromMarket: number;
  /** Consecutive most-recent entries with a positive contribution. */
  streak: number;
  months: number;
};

const EMPTY_SAVINGS: SavingsStats = {
  ready: false,
  monthlyAvg: 0,
  totalContributed: 0,
  latestValue: 0,
  marketGain: 0,
  pctFromDeposits: 0,
  pctFromMarket: 0,
  latestValueDate: "",
  liveReady: false,
  liveValue: 0,
  liveMarketGain: 0,
  livePctFromDeposits: 0,
  livePctFromMarket: 0,
  streak: 0,
  months: 0,
};

/**
 * Savings-behaviour stats derived from the investment ledger: how much is being
 * saved per month, contribution streak, and how much of the current value came
 * from deposits vs market gains.
 *
 * `latestValue`/`marketGain` come from the last ledger entry's `valueEom`, so
 * they are only as fresh as that entry. Pass `liveValue` (the portfolio total at
 * current prices) to also get the `live*` fields, which mark the same split
 * against live prices.
 */
export function computeSavingsStats(
  rows: InvestmentRow[],
  liveValue?: number,
): SavingsStats {
  if (rows.length === 0) return EMPTY_SAVINGS;

  const last = rows[rows.length - 1];
  const totalContributed = last.total;
  const latestValue = last.valueEom;
  const marketGain = latestValue - totalContributed;

  const deposits = rows.filter((r) => r.amount > 0);
  const depositSum = deposits.reduce((s, r) => s + r.amount, 0);

  const first = new Date(rows[0].date).getTime();
  const lastTs = new Date(last.date).getTime();
  const months =
    Number.isFinite(first) && Number.isFinite(lastTs) && lastTs >= first
      ? Math.max(1, Math.round((lastTs - first) / (1000 * 60 * 60 * 24 * 30.44)) + 1)
      : Math.max(1, rows.length);

  const monthlyAvg = depositSum / months;

  let streak = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].amount > 0) streak++;
    else break;
  }

  const live = Number.isFinite(liveValue) && (liveValue ?? 0) > 0 ? (liveValue as number) : 0;
  const liveMarketGain = live - totalContributed;

  return {
    ready: rows.length >= 2 && latestValue > 0,
    monthlyAvg,
    totalContributed,
    latestValue,
    marketGain,
    pctFromDeposits: latestValue > 0 ? totalContributed / latestValue : 0,
    pctFromMarket: latestValue > 0 ? marketGain / latestValue : 0,
    latestValueDate: last.date,
    liveReady: live > 0,
    liveValue: live,
    liveMarketGain,
    livePctFromDeposits: live > 0 ? totalContributed / live : 0,
    livePctFromMarket: live > 0 ? liveMarketGain / live : 0,
    streak,
    months,
  };
}

export type BenchmarkStats = {
  ready: boolean;
  /** Portfolio TWR return over the aligned window (fraction). */
  portReturn: number;
  /** KSE100 return over the same window (fraction). */
  benchReturn: number;
  /** portReturn - benchReturn (simple excess return). */
  alpha: number;
  /** cov(port, bench) / var(bench) of daily returns. */
  beta: number;
};

const EMPTY_BENCH: BenchmarkStats = {
  ready: false,
  portReturn: 0,
  benchReturn: 0,
  alpha: 0,
  beta: 0,
};

/**
 * Portfolio-vs-KSE100 stats over snapshots that carry a `kse100` level.
 * Portfolio side uses the flow-adjusted TWR index so deposits don't distort it.
 */
export function computeBenchmarkStats(snapshots: PortfolioSnapshot[]): BenchmarkStats {
  const aligned = snapshots
    .filter((s) => typeof s.kse100 === "number" && (s.kse100 as number) > 0)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  if (aligned.length < 3) return EMPTY_BENCH;

  const twr = computeTwrIndex(aligned);
  const kse = aligned.map((s) => s.kse100 as number);

  const portRet: number[] = [];
  const benchRet: number[] = [];
  for (let i = 1; i < aligned.length; i++) {
    if (twr[i - 1] > 0 && kse[i - 1] > 0) {
      portRet.push(twr[i] / twr[i - 1] - 1);
      benchRet.push(kse[i] / kse[i - 1] - 1);
    }
  }
  if (portRet.length < 2) return EMPTY_BENCH;

  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const mp = mean(portRet);
  const mb = mean(benchRet);
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < portRet.length; i++) {
    cov += (portRet[i] - mp) * (benchRet[i] - mb);
    varB += (benchRet[i] - mb) * (benchRet[i] - mb);
  }
  const beta = varB > 0 ? cov / varB : 0;

  const portReturn = twr[twr.length - 1] / 100 - 1;
  const benchReturn = kse[kse.length - 1] / kse[0] - 1;

  return {
    ready: true,
    portReturn,
    benchReturn,
    alpha: portReturn - benchReturn,
    beta,
  };
}
