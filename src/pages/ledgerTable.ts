// The Ledger table's columns and filters.
//
// Pure and separate from the page so the comparators can be tested against the
// ledger fixtures — the Value/Fees/Tax columns are computed, and a sort key that
// disagreed with its rendered cell would be invisible until someone noticed the
// numbers were in the wrong order.

import type { FeeConfig } from "../ledger/feeConfig";
import type { Transaction, TxnType } from "../ledger/types";
import { computeTradeCosts, tradeValue } from "../ledger/fees";
import { dateInRange, type ColumnDef, type TableSpec } from "../table/tableView";
import type { ChipOption } from "../components/ui/ChipGroup";

export type LedgerSortKey =
  | "date"
  | "type"
  | "ticker"
  | "shares"
  | "price"
  | "value"
  | "fees"
  | "tax";

/** Cash-only entry types — no ticker, no shares, the amount is the whole story. */
const CASH_TYPES: readonly TxnType[] = ["DEPOSIT", "WITHDRAW", "TAX", "EXPENSE"];

/**
 * What a row's Value column shows. Exported and used by both the sort comparator
 * and the cell, so the two can't drift apart.
 */
export function rowValue(txn: Transaction): number {
  if (CASH_TYPES.includes(txn.type)) return txn.amount;
  if (txn.type === "DIVIDEND") return txn.amount > 0 ? txn.amount : 0;
  if (txn.type === "SPLIT") return 0;
  return tradeValue(txn.shares, txn.price);
}

export function rowFees(txn: Transaction, cfg: FeeConfig): number {
  if (txn.type !== "BUY" && txn.type !== "SELL") return 0;
  return computeTradeCosts(txn.shares, txn.price, cfg, txn.feeOverride).total;
}

/** Shares column: a split has no share count, it has a ratio. */
function rowShares(txn: Transaction): number | null {
  if (txn.type === "SPLIT") return null;
  return txn.shares || null;
}

export const LEDGER_TYPE_OPTIONS: readonly ChipOption<TxnType>[] = [
  { value: "BUY", label: "Buy" },
  { value: "SELL", label: "Sell" },
  { value: "DIVIDEND", label: "Dividend" },
  { value: "BONUS", label: "Bonus" },
  { value: "RIGHT", label: "Rights" },
  { value: "SPLIT", label: "Split" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "WITHDRAW", label: "Withdraw" },
  { value: "EXPENSE", label: "Charge" },
  { value: "TAX", label: "Tax paid" },
];

/** URL keys this table's filters occupy, namespaced by the hook. */
export const LEDGER_FILTER_KEYS = ["type", "from", "to", "tkr"] as const;

/**
 * Predicates for the current filter values.
 *
 * An empty filter means "don't filter", never "match nothing" — clearing the last
 * type chip has to bring the whole ledger back rather than blanking the table.
 */
export function ledgerPredicates(
  filters: Record<string, string>,
): readonly ((txn: Transaction) => boolean)[] {
  const out: ((txn: Transaction) => boolean)[] = [];

  const types = filters.type ? filters.type.split(",").filter(Boolean) : [];
  if (types.length > 0) {
    const set = new Set(types);
    out.push((txn) => set.has(txn.type));
  }

  const from = filters.from;
  const to = filters.to;
  if (from || to) {
    out.push((txn) => dateInRange(txn.date, from, to));
  }

  const ticker = filters.tkr?.trim().toUpperCase();
  if (ticker) {
    out.push((txn) => txn.ticker.toUpperCase() === ticker);
  }

  return out;
}

/**
 * @param cgtByTxn CGT per transaction, and `whtByTxn` withholding — both built
 *   from the FULL ledger replay by the page. A row's tax is not derivable from the
 *   row: it depends on which lots FIFO matched.
 */
export function ledgerColumns(
  feeConfig: FeeConfig,
  cgtByTxn: Map<string, number>,
  whtByTxn: Map<string, number>,
): readonly ColumnDef<Transaction, LedgerSortKey>[] {
  const taxOf = (txn: Transaction) =>
    (cgtByTxn.get(txn.id) ?? 0) + (whtByTxn.get(txn.id) ?? 0);

  return [
    { key: "date", label: "Date", value: (t) => t.date },
    { key: "type", label: "Type", value: (t) => t.type, defaultDir: "asc" },
    // Cash entries have no ticker; an empty string would sort them together at
    // one end, which is fine and better than pretending they're missing data.
    { key: "ticker", label: "Ticker", value: (t) => t.ticker, defaultDir: "asc" },
    { key: "shares", label: "Shares", value: rowShares, align: "right" },
    { key: "price", label: "Price", value: (t) => t.price || null, align: "right" },
    { key: "value", label: "Value", value: (t) => rowValue(t) || null, align: "right" },
    {
      key: "fees",
      label: "Fees",
      value: (t) => rowFees(t, feeConfig) || null,
      align: "right",
    },
    { key: "tax", label: "Tax", value: (t) => taxOf(t) || null, align: "right" },
  ];
}

export function ledgerSpec(
  feeConfig: FeeConfig,
  cgtByTxn: Map<string, number>,
  whtByTxn: Map<string, number>,
): TableSpec<Transaction, LedgerSortKey> {
  return {
    columns: ledgerColumns(feeConfig, cgtByTxn, whtByTxn),
    // `date` is included so "2026-03" narrows to a month, which is the cheapest
    // useful thing a free-text box can do over a date-ordered ledger.
    search: (t) => [t.ticker, t.type, t.note, t.name, t.date],
  };
}

/** Newest first, ties broken by id — the order the ledger has always shown. */
export const LEDGER_DEFAULT_SORT = { key: "date", dir: "desc" } as const;
