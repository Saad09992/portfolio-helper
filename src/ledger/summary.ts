import type { StockLedgerRow } from "./perStock";

/**
 * Portfolio-level roll-up of the per-stock ledger rows.
 *
 * Every field is a plain reduce over `StockLedgerRow[]` — no financial logic is
 * re-derived here, so this cannot drift away from `perStock.ts`/`replay.ts`.
 */
export type LedgerSummary = {
  /** false when there are no ledger rows — the UI shows an empty state. */
  ready: boolean;

  /** paisa — net of the fees and CGT attributed to each sale. */
  realized: number;
  unrealized: number;
  /** paisa — net of dividend withholding. */
  dividends: number;

  /**
   * paisa — realized + unrealized + dividends − expenses − taxPaid. THE headline.
   *
   * Satisfies `contributions + netTotal === cash + market value`: everything
   * that happened to the money is in here exactly once.
   *
   * Do not subtract `feesPaid`/`taxesBooked` from this. Both are already inside
   * the components: buy fees are capitalized into lot cost, sell fees are
   * deducted inside `realized`, and withholding inside `dividends`. Accrued CGT
   * is in neither — it is not spent, and may never be owed once losses are set
   * off. Subtracting any of them again double-counts.
   */
  netTotal: number;

  /** paisa — account charges: SMS, custody, maintenance, unitemised brokerage. */
  expenses: number;
  /** paisa — tax actually paid: CGT settlements and bonus-issue tax. */
  taxPaid: number;

  /** paisa — brokerage and statutory charges paid across all trades. */
  feesPaid: number;
  /**
   * paisa — CGT, dividend withholding and bonus tax *booked*.
   *
   * "Booked", not "paid": withholding has actually left your hands, but accrued
   * CGT has not — NCCPL debits it later. Pair this with the CGT reserve when
   * displaying it, and never call it cash out the door.
   */
  taxesBooked: number;

  /**
   * paisa — what every buy cost, and what every sale returned, summed across
   * every ticker for all time.
   *
   * This is turnover, NOT capital. Selling and rebuying counts the same rupee
   * twice, so on an account that trades often it runs to many times the money
   * actually contributed. Never use it as the denominator of a return, and
   * never label it "invested" in the UI — use `contributions`.
   */
  invested: number;
  returned: number;

  /** paisa — capital actually put in: deposits less withdrawals. */
  contributions: number;

  /** netTotal as a percent of `contributions`. Whole percent. */
  netReturnPct: number;
  /** (fees + expenses) as a percent of `contributions`. Whole percent. */
  feeDragPct: number;

  /** paisa — unrealized less the estimated cost of liquidating everything now. */
  netIfSoldToday: number;

  /** Realized slices, not tickers: one part-sale of one lot counts once. */
  closedTrades: number;
  wins: number;
  winRatePct: number;
  /** paisa — best and worst single realized slice. */
  bestTrade: number;
  worstTrade: number;

  openPositions: number;
  closedPositions: number;

  topContributor?: { ticker: string; totalNet: number; contributionPct: number };
  worstContributor?: { ticker: string; totalNet: number; contributionPct: number };
};

const EMPTY: LedgerSummary = {
  ready: false,
  realized: 0,
  unrealized: 0,
  dividends: 0,
  netTotal: 0,
  feesPaid: 0,
  taxesBooked: 0,
  invested: 0,
  returned: 0,
  contributions: 0,
  expenses: 0,
  taxPaid: 0,
  netReturnPct: 0,
  feeDragPct: 0,
  netIfSoldToday: 0,
  closedTrades: 0,
  wins: 0,
  winRatePct: 0,
  bestTrade: 0,
  worstTrade: 0,
  openPositions: 0,
  closedPositions: 0,
};

/**
 * @param contributions paisa — deposits less withdrawals, from the replay. The
 *   denominator for every percentage here; without it a return would be
 *   measured against turnover and shrink each time the portfolio recycles.
 */
export function buildLedgerSummary(
  rows: StockLedgerRow[],
  contributions = 0,
  expenses = 0,
  taxPaid = 0,
): LedgerSummary {
  if (rows.length === 0) return { ...EMPTY, contributions, expenses, taxPaid };

  let realized = 0;
  let unrealized = 0;
  let dividends = 0;
  let feesPaid = 0;
  let taxesBooked = 0;
  let invested = 0;
  let returned = 0;
  let netIfSoldToday = 0;
  let closedTrades = 0;
  let wins = 0;
  let openPositions = 0;
  let closedPositions = 0;

  let best: StockLedgerRow | undefined;
  let worst: StockLedgerRow | undefined;
  // Trade extremes come from the per-slice stats, so they describe one sale
  // rather than one ticker's lifetime.
  let bestTrade = 0;
  let worstTrade = 0;

  for (const row of rows) {
    realized += row.realized;
    unrealized += row.unrealized;
    dividends += row.dividends;
    feesPaid += row.feesPaid;
    taxesBooked += row.taxesPaid;
    invested += row.invested;
    returned += row.returned;
    netIfSoldToday += row.netIfSoldToday;
    closedTrades += row.closed.count;
    wins += row.closed.wins;
    if (row.isClosed) closedPositions++;
    else openPositions++;

    if (row.closed.count > 0) {
      bestTrade = Math.max(bestTrade, row.closed.best);
      worstTrade = Math.min(worstTrade, row.closed.worst);
    }

    if (!best || row.totalNet > best.totalNet) best = row;
    if (!worst || row.totalNet < worst.totalNet) worst = row;
  }

  const netTotal = realized + unrealized + dividends - expenses - taxPaid;

  const contributor = (row: StockLedgerRow | undefined) =>
    row
      ? {
          ticker: row.ticker,
          totalNet: row.totalNet,
          contributionPct: row.contributionPct,
        }
      : undefined;

  return {
    ready: true,
    realized,
    unrealized,
    dividends,
    netTotal,
    feesPaid,
    taxesBooked,
    invested,
    returned,
    contributions,
    expenses,
    taxPaid,
    netReturnPct: contributions > 0 ? (netTotal / contributions) * 100 : 0,
    // Accrued CGT is excluded: it has not been paid and may never be owed.
    feeDragPct: contributions > 0 ? ((feesPaid + expenses) / contributions) * 100 : 0,
    netIfSoldToday,
    closedTrades,
    wins,
    winRatePct: closedTrades > 0 ? (wins / closedTrades) * 100 : 0,
    bestTrade,
    worstTrade,
    openPositions,
    closedPositions,
    topContributor: contributor(best),
    worstContributor: contributor(worst),
  };
}
