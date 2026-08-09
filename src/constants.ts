// Centralized tuning knobs. Group by domain.

import { ALL_ROWS } from "./table/tableView";
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
  /** Ring height for the allocation donut; the legend sits under it. */
  DONUT_HEIGHT: 220,
  /** Legend rows before the tail is summarised as "+ N more". */
  DONUT_LEGEND_ROWS: 10,
  /**
   * Delay before a search box mirrors itself into the URL. Long enough that
   * typing a word is one history write, not one per keystroke — Safari throttles
   * `replaceState` to roughly 100 calls per 30 seconds.
   */
  SEARCH_URL_DEBOUNCE_MS: 300,
} as const;

export const TABLE = {
  /** Rows per page before the user changes it. 357 ledger entries → 8 pages. */
  DEFAULT_PAGE_SIZE: 50,
  /** Compact default for the sub-tables inside the stock detail panel. */
  DETAIL_PAGE_SIZE: 10,
  /**
   * Row-count options offered in the pager. `ALL_ROWS` (-1) is the escape hatch
   * that restores the scan-the-whole-thing / Ctrl-F workflow.
   */
  PAGE_SIZES: [25, 50, 100, ALL_ROWS] as const,
  /**
   * Below this many matching rows the pager renders nothing at all — a six-row
   * Holdings table has no business showing paging chrome.
   */
  PAGER_MIN_ROWS: 25,
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
