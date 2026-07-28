import { describe, expect, it } from "vitest";
import { affectsLaterSales, describeTransaction, describeTransactionWithDate } from "./describe";
import type { Transaction, TxnType } from "./types";
import { formatCurrency } from "../utils";

let seq = 0;
function txn(type: TxnType, over: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `c${seq}`,
    date: "2025-06-10",
    type,
    ticker: "LUCK",
    name: "Lucky Cement",
    sector: "Materials",
    shares: 0,
    price: 0,
    amount: 0,
    note: "",
    ...over,
  };
}

describe("describeTransaction", () => {
  it("describes a trade with its size and price", () => {
    expect(describeTransaction(txn("BUY", { shares: 100, price: 14_500 }))).toBe(
      `BUY 100 LUCK @ ${formatCurrency(14_500)}`,
    );
  });

  it("describes cash movements by amount", () => {
    expect(describeTransaction(txn("DEPOSIT", { ticker: "", amount: 9_164_555 }))).toBe(
      `DEPOSIT ${formatCurrency(9_164_555)}`,
    );
  });

  it("describes a split by its ratio", () => {
    expect(describeTransaction(txn("SPLIT", { ratioFrom: 1, ratioTo: 5 }))).toBe(
      "SPLIT LUCK 1:5",
    );
  });

  it("describes a dividend by per-share rate, or by total when given", () => {
    expect(describeTransaction(txn("DIVIDEND", { price: 250 }))).toBe(
      `DIVIDEND LUCK @ ${formatCurrency(250)}/share`,
    );
    expect(describeTransaction(txn("DIVIDEND", { price: 250, amount: 30_000 }))).toBe(
      `DIVIDEND LUCK ${formatCurrency(30_000)}`,
    );
  });

  it("prefixes the date on the long form", () => {
    expect(describeTransactionWithDate(txn("BONUS", { shares: 20 }))).toBe(
      "10 Jun — BONUS 20 LUCK",
    );
  });
});

describe("affectsLaterSales", () => {
  const buy = txn("BUY", { date: "2025-01-10", shares: 100, price: 14_500 });
  const sell = txn("SELL", { date: "2025-06-10", shares: 30, price: 16_000 });
  const otherSell = txn("SELL", { date: "2025-06-10", ticker: "PSO", shares: 30, price: 16_000 });

  it("flags a buy that a later sale matched against", () => {
    expect(affectsLaterSales(buy, [buy, sell])).toBe(true);
  });

  it("ignores sales of a different stock", () => {
    expect(affectsLaterSales(buy, [buy, otherSell])).toBe(false);
  });

  it("ignores sales that came before it", () => {
    const lateBuy = txn("BUY", { date: "2025-12-01", shares: 10, price: 14_500 });
    expect(affectsLaterSales(lateBuy, [lateBuy, sell])).toBe(false);
  });

  it("does not flag the sale itself or cash entries", () => {
    expect(affectsLaterSales(sell, [buy, sell])).toBe(false);
    expect(affectsLaterSales(txn("DEPOSIT", { ticker: "", amount: 100 }), [sell])).toBe(false);
  });

  it("flags corporate actions, which also reshape the lots", () => {
    const split = txn("SPLIT", { date: "2025-03-01", ratioFrom: 1, ratioTo: 2 });
    expect(affectsLaterSales(split, [split, sell])).toBe(true);
  });
});
