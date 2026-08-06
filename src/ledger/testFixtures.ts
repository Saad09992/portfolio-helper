// Shared ledger fixtures. Kept in one place so the page smoke tests and the
// stats tests reason about the same trades — if a fixture and an assertion drift
// apart, the test stops describing anything real.
import type { Transaction, TxnType } from "./types";

export const txn = (
  o: Partial<Transaction> & { id: string; date: string; type: TxnType },
): Transaction => ({
  ticker: "",
  name: "",
  sector: "",
  shares: 0,
  price: 0,
  amount: 0,
  note: "",
  ...o,
});

/**
 * One ticker: bought 100, sold 30, a dividend, then an oversized SELL of 9999
 * that exercises the "sell more than you hold" guard.
 *
 * The oversized entry is *skipped* rather than clamped (it lands in
 * `state.issues`), so 70 shares remain open — this fixture is the partially-sold
 * case, not a fully closed one. Use `mixedTransactions` for closed positions.
 */
export const partiallySoldTransactions: Transaction[] = [
  txn({ id: "d1", date: "2025-01-01", type: "DEPOSIT", amount: 5_000_000 }),
  txn({ id: "b1", date: "2025-01-10", type: "BUY", ticker: "LUCK", name: "Lucky Cement", sector: "Materials", shares: 100, price: 14500 }),
  txn({ id: "s1", date: "2025-06-10", type: "SELL", ticker: "LUCK", shares: 30, price: 16000 }),
  txn({ id: "v1", date: "2025-07-10", type: "DIVIDEND", ticker: "LUCK", price: 250 }),
  txn({ id: "x1", date: "2025-08-10", type: "SELL", ticker: "LUCK", shares: 9999, price: 16000 }),
];

/**
 * A closed winner, a still-open position, and a realized loser — enough shape to
 * exercise win rate, contribution ranking and the open/closed split.
 */
export const mixedTransactions: Transaction[] = [
  txn({ id: "d1", date: "2025-01-01", type: "DEPOSIT", amount: 20_000_000 }),
  // Closed at a profit.
  txn({ id: "b1", date: "2025-01-10", type: "BUY", ticker: "LUCK", name: "Lucky Cement", sector: "Materials", shares: 100, price: 14_500 }),
  txn({ id: "s1", date: "2025-06-10", type: "SELL", ticker: "LUCK", shares: 100, price: 18_000 }),
  // Still open, and pays a dividend.
  txn({ id: "b2", date: "2025-02-10", type: "BUY", ticker: "ENGRO", name: "Engro Corp", sector: "Materials", shares: 200, price: 28_000 }),
  txn({ id: "v2", date: "2025-07-10", type: "DIVIDEND", ticker: "ENGRO", price: 400 }),
  // Closed at a loss.
  txn({ id: "b3", date: "2025-03-10", type: "BUY", ticker: "OGDC", name: "Oil & Gas Development", sector: "Energy", shares: 300, price: 13_000 }),
  txn({ id: "s3", date: "2025-09-10", type: "SELL", ticker: "OGDC", shares: 300, price: 11_000 }),
];

export const mixedPrices = new Map<string, number>([
  ["LUCK", 18_500],
  ["ENGRO", 31_000],
  ["OGDC", 11_500],
]);
