// The Holdings table's columns.
//
// Split out of the page so the comparators are testable — and because this table
// has the one URL contract in the app that must not move: `#/holdings?q=…&sort=…
// &dir=…` is documented in `src/routes.ts` and is what the Overview sector
// drill-down (`holdingsQueryHref`) links to.

import type { DerivedHolding } from "../types";
import type { HoldingsSortKey } from "../uiTypes";
import type { TableSpec } from "../table/tableView";

/**
 * P&L today, in paisa.
 *
 * Backs out today's move from the current market value:
 * `value × pct / (100 + pct)`. The `|| 1` guard is load-bearing and predates this
 * module — it catches `pct === -100` (a total wipeout), where the denominator
 * would otherwise be zero.
 */
export function pnlToday(holding: DerivedHolding): number {
  return (holding.marketValue * holding.dayChangePct) / (100 + holding.dayChangePct || 1);
}

export const HOLDINGS_SPEC: TableSpec<DerivedHolding, HoldingsSortKey> = {
  columns: [
    { key: "ticker", label: "Ticker", value: (h) => h.ticker, defaultDir: "asc" },
    { key: "name", label: "Name", value: (h) => h.name, defaultDir: "asc" },
    { key: "sector", label: "Sector", value: (h) => h.sector, defaultDir: "asc" },
    { key: "shares", label: "Shares", value: (h) => h.shares, align: "right" },
    { key: "costBasis", label: "Avg price", value: (h) => h.costBasis, align: "right" },
    { key: "price", label: "Current price", value: (h) => h.price, align: "right" },
    { key: "dayChangePct", label: "Day %", value: (h) => h.dayChangePct, align: "right" },
    { key: "marketValue", label: "Market value", value: (h) => h.marketValue, align: "right" },
    { key: "weight", label: "Weight", value: (h) => h.weight, align: "right" },
    { key: "pnlToday", label: "P&L today", value: pnlToday, align: "right" },
    { key: "gainLoss", label: "P&L total", value: (h) => h.gainLoss, align: "right" },
  ],
  search: (h) => [h.ticker, h.name, h.sector],
  // Cash is not a position. It sits first in the page's own order and is held last
  // once a column is sorted, so it never lands between two stocks.
  pinLast: (h) => h.id.startsWith("cash-"),
};
