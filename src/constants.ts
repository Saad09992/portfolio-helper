// Centralized tuning knobs. Group by domain.

import type { RebalanceCadence } from "./types";

export const DRIFT = {
  /** |currentWeight - target| above which a target is "severe" drift */
  SEVERE: 0.05,
  /** |currentWeight - target| above which a target is "moderate" drift */
  MODERATE: 0.02,
  /** drift magnitude beyond which a target counts as over/under in the summary */
  COUNT_THRESHOLD: 0.005,
} as const;

export const REBALANCE = {
  /** Paisa floor (₨5,000) below which a rebalance gap is too small to suggest */
  MIN_PKR: 500000,
  /** Fraction-of-portfolio floor below which a rebalance gap is suppressed */
  MIN_PORTFOLIO_FRACTION: 0.01,
  /** Max suggestions surfaced in the rebalance panel */
  MAX_SUGGESTIONS: 8,
} as const;

export const HISTORY = {
  /** Max daily PVOT snapshots retained (≈ one calendar year) */
  MAX_DAYS: 365,
} as const;

export const UI_LIMITS = {
  UPCOMING_DIVIDENDS: 4,
  TOP_MOVERS: 6,
  TREEMAP_TOP_N: 12,
  WATERFALL_TOP_N: 10,
  /**
   * Delay before a search box mirrors itself into the URL. Long enough that
   * typing a word is one history write, not one per keystroke — Safari throttles
   * `replaceState` to roughly 100 calls per 30 seconds.
   */
  SEARCH_URL_DEBOUNCE_MS: 300,
} as const;

export const PERSISTENCE = {
  /** Debounce window for disk-save POSTs */
  SAVE_DEBOUNCE_MS: 500,
} as const;

export const TARGET_DEFAULTS = {
  /** Default warn threshold (5%) applied to targets that don't specify one. */
  WARN_THRESHOLD: 0.05,
  /** Default critical threshold (10%) applied to targets that don't specify one. */
  CRITICAL_THRESHOLD: 0.10,
  /** Default rebalance cadence applied to targets that don't specify one. */
  CADENCE: "monthly" as RebalanceCadence,
} as const;

export const CADENCE_DAYS: Record<RebalanceCadence, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
};

export const ANALYTICS = {
  /**
   * Snapshots required before an annualized figure (CAGR, and therefore Sharpe)
   * is worth showing. Below roughly a quarter of data, annualizing a few days of
   * returns produces numbers in the thousands.
   */
  MIN_ANNUALIZE_SNAPSHOTS: 60,
  /** Annual risk-free rate for Sharpe (≈ PSX T-bill yield). Tweak as rates move. */
  RISK_FREE_ANNUAL: 0.11,
  /** Calendar days per year — snapshots are daily (incl. weekends), so
   *  annualize volatility/return on a 365-day basis. */
  TRADING_DAYS: 365,
} as const;
