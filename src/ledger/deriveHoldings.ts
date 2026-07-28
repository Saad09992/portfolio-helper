// Bridge from ledger state to the `Holding` shape the rest of the app already
// consumes (`computePortfolio`, charts, targets, summary, the cron snapshot).
//
// Share counts and cost basis come from the ledger; price, day change and
// dividend metadata come from the previously stored holding row, which is what
// the scrapers and the cron keep refreshing. Nothing downstream has to change.

import { roundPaisa } from "../money";
import type { Holding } from "../types";
import type { LedgerState, PositionState } from "./types";

/** Stable id for a ledger-derived holding that has no prior stored row. */
export function ledgerHoldingId(ticker: string): string {
  return `ledger-${ticker.toUpperCase()}`;
}

/**
 * Average cost per share, rounded to whole paisa.
 *
 * NOTE: this is a display/compatibility figure. `shares × avgCost` can differ
 * from the position's exact cost by up to half a paisa per share, so anything
 * that needs the true cost (headline totals, P&L, tax) reads `position.cost`
 * from the ledger instead of multiplying this back out.
 */
export function averageCost(position: PositionState): number {
  return position.shares > 0 ? roundPaisa(position.cost / position.shares) : 0;
}

/**
 * Derived holdings, newest position first, matching the order of `previous`
 * where possible so the table doesn't reshuffle on every refresh.
 *
 * Positions closed out (zero open shares) drop off the holdings list — their
 * realized P&L still lives in the ledger and shows on the per-stock pages.
 */
export function deriveHoldings(
  state: LedgerState,
  previous: Holding[] = [],
): Holding[] {
  const priorByTicker = new Map<string, Holding>();
  for (const h of previous) {
    if (h.id.startsWith("cash-")) continue;
    priorByTicker.set(h.ticker.toUpperCase(), h);
  }

  const open = [...state.positions.values()].filter((p) => p.shares > 0);

  // Preserve the previous row order, then append tickers new to the ledger.
  const order = new Map<string, number>();
  previous.forEach((h, i) => order.set(h.ticker.toUpperCase(), i));
  open.sort(
    (a, b) =>
      (order.get(a.ticker) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.ticker) ?? Number.MAX_SAFE_INTEGER),
  );

  return open.map((position) => {
    const prior = priorByTicker.get(position.ticker);
    const holding: Holding = {
      id: prior?.id ?? ledgerHoldingId(position.ticker),
      ticker: position.ticker,
      name: position.name || prior?.name || position.ticker,
      sector: position.sector || prior?.sector || "Uncategorized",
      account: prior?.account ?? "PSX",
      shares: position.shares,
      // Fall back to average cost when no quote has ever been fetched, so a
      // brand-new position shows at cost rather than at zero.
      price: prior?.price && prior.price > 0 ? prior.price : averageCost(position),
      costBasis: averageCost(position),
      dayChangePct: prior?.dayChangePct ?? 0,
      dividendPerShare: prior?.dividendPerShare ?? 0,
      payoutDate: prior?.payoutDate ?? "",
    };
    if (prior?.payouts) holding.payouts = prior.payouts;
    return holding;
  });
}

/** Exact ledger totals — the authority for headline cost and open P&L. */
export function ledgerTotals(
  state: LedgerState,
  priceByTicker: Map<string, number>,
): {
  openCost: number;
  marketValue: number;
  unrealized: number;
  realized: number;
  dividends: number;
  feesPaid: number;
  taxesPaid: number;
} {
  let openCost = 0;
  let marketValue = 0;
  let realized = 0;
  let dividends = 0;
  let feesPaid = 0;
  let taxesPaid = 0;

  for (const position of state.positions.values()) {
    openCost += position.cost;
    const price = priceByTicker.get(position.ticker) ?? averageCost(position);
    marketValue += position.shares * price;
    realized += position.realized;
    dividends += position.dividends;
    feesPaid += position.feesPaid;
    taxesPaid += position.taxesPaid;
  }

  return {
    openCost,
    marketValue,
    unrealized: marketValue - openCost,
    realized,
    dividends,
    feesPaid,
    taxesPaid,
  };
}
