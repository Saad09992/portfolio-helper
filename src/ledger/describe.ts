// Human-readable one-liners for a ledger entry, used in confirmation prompts.

import { formatCurrency, formatDateShort } from "../utils";
import { dayOf } from "./replay";
import type { Transaction } from "./types";

/** e.g. "BUY 100 LUCK @ Rs 145.00" or "DEPOSIT Rs 91,645.55". */
export function describeTransaction(txn: Transaction): string {
  switch (txn.type) {
    case "DEPOSIT":
    case "WITHDRAW":
      return `${txn.type} ${formatCurrency(txn.amount)}`;
    case "SPLIT":
      return `SPLIT ${txn.ticker} ${txn.ratioFrom}:${txn.ratioTo}`;
    case "DIVIDEND":
      return txn.amount > 0
        ? `DIVIDEND ${txn.ticker} ${formatCurrency(txn.amount)}`
        : `DIVIDEND ${txn.ticker} @ ${formatCurrency(txn.price)}/share`;
    case "BONUS":
      return `BONUS ${txn.shares.toLocaleString()} ${txn.ticker}`;
    default:
      return `${txn.type} ${txn.shares.toLocaleString()} ${txn.ticker} @ ${formatCurrency(txn.price)}`;
  }
}

/** Same, with the trade date in front. */
export function describeTransactionWithDate(txn: Transaction): string {
  return `${formatDateShort(txn.date)} — ${describeTransaction(txn)}`;
}

/**
 * True when removing `txn` would re-run FIFO matching for sales that came
 * later: any lot-changing entry on the same ticker with a sale after it. Those
 * sales keep their price but match different lots, so realized P&L and CGT move.
 */
export function affectsLaterSales(txn: Transaction, all: Transaction[]): boolean {
  if (!["BUY", "RIGHT", "BONUS", "SPLIT"].includes(txn.type)) return false;
  const ticker = txn.ticker.toUpperCase();
  const day = dayOf(txn.date);
  return all.some(
    (other) =>
      other.id !== txn.id &&
      other.type === "SELL" &&
      other.ticker.toUpperCase() === ticker &&
      dayOf(other.date) >= day,
  );
}
