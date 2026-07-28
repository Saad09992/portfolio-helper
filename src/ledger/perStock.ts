// Per-stock performance rows built from ledger state.
//
// The headline figure is NET: realized P&L after fees and CGT, plus dividends
// after withholding, plus the open position's unrealized gain. `netIfSoldToday`
// goes one step further and subtracts what closing the position would cost.

import { roundPaisa } from "../money";
import type { FeeConfig } from "./feeConfig";
import { allocateProRata, computeTradeCosts, tradeValue } from "./fees";
import { averageCost } from "./deriveHoldings";
import { cgtRateFor, dayOf } from "./replay";
import type { LedgerState, PositionState, RealizedSlice } from "./types";

export type ClosedTradeStats = {
  /** number of realized slices (a part-sale of one lot counts once) */
  count: number;
  wins: number;
  winRatePct: number;
  /** paisa — best and worst realized gain, net of that slice's fees */
  best: number;
  worst: number;
};

export type StockLedgerRow = {
  ticker: string;
  name: string;
  sector: string;
  /** open shares */
  shares: number;
  /** paisa per share, rounded average — see `averageCost` */
  avgCost: number;
  /** paisa — exact open-position cost, fee-inclusive */
  openCost: number;
  /** paisa per share */
  price: number;
  marketValue: number;
  unrealized: number;
  /** paisa — estimated cost of closing the position right now */
  exitFees: number;
  exitCgt: number;
  /** paisa — unrealized less the estimated exit costs */
  netIfSoldToday: number;
  /** paisa — net realized P&L to date */
  realized: number;
  /** paisa — dividends received, after withholding */
  dividends: number;
  /** paisa — realized + unrealized + dividends. The headline. */
  totalNet: number;
  /** paisa — lifetime cash put into this ticker */
  invested: number;
  /** paisa — lifetime cash taken back out */
  returned: number;
  totalReturnPct: number;
  feesPaid: number;
  taxesPaid: number;
  /** (fees + taxes) as a percent of lifetime cash invested */
  feeDragPct: number;
  firstDate: string;
  lastDate: string;
  /** share-weighted days held (open lots), or the full span once closed */
  holdingDays: number;
  closed: ClosedTradeStats;
  /** this stock's share of the portfolio's total net P&L, percent */
  contributionPct: number;
  /** true once every share has been sold */
  isClosed: boolean;
};

const MS_PER_DAY = 86_400_000;

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${dayOf(from)}T00:00:00Z`);
  const b = Date.parse(`${dayOf(to)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / MS_PER_DAY));
}

/**
 * What it would cost to liquidate the whole open position at `price` today:
 * brokerage on the way out plus CGT on each open lot at its own rate tier.
 */
export function estimateExitCosts(
  position: PositionState,
  price: number,
  cfg: FeeConfig,
): { fees: number; cgt: number } {
  if (position.shares <= 0 || price <= 0) return { fees: 0, cgt: 0 };

  const value = tradeValue(position.shares, price);
  const fees = computeTradeCosts(position.shares, price, cfg).total;

  const weights = position.lots.map((lot) => lot.shares);
  const proceedsParts = allocateProRata(value, weights);
  const feeParts = allocateProRata(fees, weights);

  let cgt = 0;
  position.lots.forEach((lot, i) => {
    const gain = proceedsParts[i] - feeParts[i] - lot.cost;
    if (gain > 0) cgt += roundPaisa((gain * cgtRateFor(lot.date, cfg)) / 100);
  });

  return { fees, cgt };
}

/** Share-weighted days held across the open lots. */
function weightedHoldingDays(position: PositionState, asOf: string): number {
  if (position.shares <= 0) {
    return position.firstDate && position.lastDate
      ? daysBetween(position.firstDate, position.lastDate)
      : 0;
  }
  const total = position.lots.reduce(
    (sum, lot) => sum + lot.shares * daysBetween(lot.date, asOf),
    0,
  );
  return Math.round(total / position.shares);
}

function closedStats(slices: RealizedSlice[]): ClosedTradeStats {
  if (slices.length === 0) {
    return { count: 0, wins: 0, winRatePct: 0, best: 0, worst: 0 };
  }
  const gains = slices.map((s) => s.gain);
  const wins = gains.filter((g) => g > 0).length;
  return {
    count: slices.length,
    wins,
    winRatePct: (wins / slices.length) * 100,
    best: Math.max(...gains),
    worst: Math.min(...gains),
  };
}

/**
 * One row per ticker that has ever been traded — including fully closed
 * positions, whose realized P&L and dividends still count.
 *
 * `asOf` is injected (ISO date) rather than read from the clock, so the whole
 * module stays pure and testable.
 */
export function buildStockRows(
  state: LedgerState,
  priceByTicker: Map<string, number>,
  cfg: FeeConfig,
  asOf: string,
): StockLedgerRow[] {
  const slicesByTicker = new Map<string, RealizedSlice[]>();
  for (const slice of state.realized) {
    const list = slicesByTicker.get(slice.ticker) ?? [];
    list.push(slice);
    slicesByTicker.set(slice.ticker, list);
  }

  const rows: StockLedgerRow[] = [];

  for (const position of state.positions.values()) {
    const price =
      priceByTicker.get(position.ticker) ?? (position.shares > 0 ? averageCost(position) : 0);
    const marketValue = position.shares * price;
    const unrealized = position.shares > 0 ? marketValue - position.cost : 0;
    const exit = estimateExitCosts(position, price, cfg);
    const totalNet = position.realized + unrealized + position.dividends;

    rows.push({
      ticker: position.ticker,
      name: position.name || position.ticker,
      sector: position.sector || "Uncategorized",
      shares: position.shares,
      avgCost: averageCost(position),
      openCost: position.cost,
      price,
      marketValue,
      unrealized,
      exitFees: exit.fees,
      exitCgt: exit.cgt,
      netIfSoldToday: unrealized - exit.fees - exit.cgt,
      realized: position.realized,
      dividends: position.dividends,
      totalNet,
      invested: position.invested,
      returned: position.returned,
      totalReturnPct: position.invested > 0 ? (totalNet / position.invested) * 100 : 0,
      feesPaid: position.feesPaid,
      taxesPaid: position.taxesPaid,
      feeDragPct:
        position.invested > 0
          ? ((position.feesPaid + position.taxesPaid) / position.invested) * 100
          : 0,
      firstDate: position.firstDate,
      lastDate: position.lastDate,
      holdingDays: weightedHoldingDays(position, asOf),
      closed: closedStats(slicesByTicker.get(position.ticker) ?? []),
      contributionPct: 0, // filled in below, once the portfolio total is known
      isClosed: position.shares <= 0,
    });
  }

  // Contribution is a share of the portfolio's total net P&L. Use the sum of
  // absolute P&L as the denominator so a portfolio whose winners and losers
  // cancel out doesn't produce meaningless 500% contributions.
  const scale = rows.reduce((sum, row) => sum + Math.abs(row.totalNet), 0);
  if (scale > 0) {
    for (const row of rows) row.contributionPct = (row.totalNet / scale) * 100;
  }

  rows.sort((a, b) => b.marketValue - a.marketValue || b.totalNet - a.totalNet);
  return rows;
}
