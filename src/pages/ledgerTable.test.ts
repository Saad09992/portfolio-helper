import { describe, expect, it } from "vitest";
import { DEFAULT_FEE_CONFIG } from "../ledger/feeConfig";
import { computeTradeCosts, tradeValue } from "../ledger/fees";
import { mixedTransactions, txn } from "../ledger/testFixtures";
import type { TxnType } from "../ledger/types";
import { buildView, matchRows, sortRows } from "../table/tableView";
import {
  LEDGER_TYPE_OPTIONS,
  ledgerPredicates,
  ledgerSpec,
  rowFees,
  rowValue,
  type LedgerSortKey,
} from "./ledgerTable";

const cfg = DEFAULT_FEE_CONFIG;
const noTax = new Map<string, number>();
const spec = ledgerSpec(cfg, noTax, noTax);

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id);

const view = (
  rows: typeof mixedTransactions,
  over: Partial<{
    query: string;
    sort: { key: LedgerSortKey | null; dir: "asc" | "desc" };
    page: number;
    pageSize: number;
  }> = {},
) =>
  buildView(rows, spec, {
    query: "",
    sort: { key: null, dir: "desc" },
    page: 1,
    pageSize: 50,
    ...over,
  });

describe("LEDGER_TYPE_OPTIONS", () => {
  it("covers every TxnType exactly once", () => {
    // Exhaustiveness by construction: adding an 11th type without a chip would
    // silently make those rows unreachable through the filter.
    const all: TxnType[] = [
      "BUY",
      "SELL",
      "DIVIDEND",
      "BONUS",
      "RIGHT",
      "SPLIT",
      "DEPOSIT",
      "WITHDRAW",
      "TAX",
      "EXPENSE",
    ];
    const covered = LEDGER_TYPE_OPTIONS.map((o) => o.value);
    expect([...covered].sort()).toEqual([...all].sort());
    expect(new Set(covered).size).toBe(covered.length);
  });
});

describe("rowValue", () => {
  it("uses the trade value for buys, sells and rights", () => {
    const buy = txn({ id: "b", date: "2025-01-01", type: "BUY", shares: 100, price: 14_500 });
    expect(rowValue(buy)).toBe(tradeValue(100, 14_500));
  });

  it("uses the cash amount for cash entries", () => {
    for (const type of ["DEPOSIT", "WITHDRAW", "TAX", "EXPENSE"] as const) {
      expect(rowValue(txn({ id: "c", date: "2025-01-01", type, amount: 12_345 }))).toBe(12_345);
    }
  });

  it("uses the gross override for a dividend, and 0 when absent", () => {
    expect(rowValue(txn({ id: "v", date: "2025-01-01", type: "DIVIDEND", amount: 900 }))).toBe(900);
    expect(rowValue(txn({ id: "v", date: "2025-01-01", type: "DIVIDEND", price: 250 }))).toBe(0);
  });

  it("is 0 for a split — a ratio is not a value", () => {
    expect(
      rowValue(txn({ id: "sp", date: "2025-01-01", type: "SPLIT", ratioFrom: 1, ratioTo: 2 })),
    ).toBe(0);
  });
});

describe("rowFees", () => {
  it("matches computeTradeCosts for buys and sells", () => {
    const sell = txn({ id: "s", date: "2025-01-01", type: "SELL", shares: 30, price: 16_000 });
    expect(rowFees(sell, cfg)).toBe(computeTradeCosts(30, 16_000, cfg).total);
  });

  it("is 0 for every non-trade type", () => {
    for (const type of ["DIVIDEND", "BONUS", "RIGHT", "SPLIT", "DEPOSIT", "WITHDRAW", "TAX", "EXPENSE"] as const) {
      expect(rowFees(txn({ id: "x", date: "2025-01-01", type, shares: 10, price: 100 }), cfg), type)
        .toBe(0);
    }
  });

  it("honours a fee override", () => {
    const overridden = txn({
      id: "s",
      date: "2025-01-01",
      type: "SELL",
      shares: 30,
      price: 16_000,
      feeOverride: { total: 777 },
    });
    expect(rowFees(overridden, cfg)).toBe(777);
  });
});

describe("ledgerPredicates", () => {
  it("returns nothing for empty filters, so the table is unfiltered", () => {
    expect(ledgerPredicates({})).toHaveLength(0);
  });

  it("treats an empty type list as no filter rather than match-nothing", () => {
    // Clearing the last chip has to bring the ledger back, not blank it.
    expect(ledgerPredicates({ type: "" })).toHaveLength(0);
    const specWith = { ...spec, predicates: ledgerPredicates({ type: "" }) };
    expect(matchRows(mixedTransactions, specWith, "")).toHaveLength(mixedTransactions.length);
  });

  it("filters to a single type", () => {
    const specWith = { ...spec, predicates: ledgerPredicates({ type: "SELL" }) };
    expect(ids(matchRows(mixedTransactions, specWith, ""))).toEqual(["s1", "s3"]);
  });

  it("filters to several types, comma-separated", () => {
    const specWith = { ...spec, predicates: ledgerPredicates({ type: "SELL,DIVIDEND" }) };
    expect(ids(matchRows(mixedTransactions, specWith, ""))).toEqual(["s1", "v2", "s3"]);
  });

  it("filters by ticker, case-insensitively", () => {
    for (const tkr of ["OGDC", "ogdc", " ogdc "]) {
      const specWith = { ...spec, predicates: ledgerPredicates({ tkr }) };
      expect(ids(matchRows(mixedTransactions, specWith, "")), tkr).toEqual(["b3", "s3"]);
    }
  });

  describe("date range", () => {
    const range = (from?: string, to?: string) => ({
      ...spec,
      predicates: ledgerPredicates({ ...(from ? { from } : {}), ...(to ? { to } : {}) }),
    });

    it("is inclusive at both ends", () => {
      // b1 is 2025-01-10, s1 is 2025-06-10.
      expect(ids(matchRows(mixedTransactions, range("2025-01-10", "2025-06-10"), "")))
        .toEqual(["b1", "s1", "b2", "b3"]);
    });

    it("accepts an open-ended range", () => {
      expect(ids(matchRows(mixedTransactions, range("2025-09-01", undefined), ""))).toEqual(["s3"]);
      expect(ids(matchRows(mixedTransactions, range(undefined, "2025-01-10"), "")))
        .toEqual(["d1", "b1"]);
    });
  });

  it("ANDs a type, a ticker and a range together", () => {
    const specWith = {
      ...spec,
      predicates: ledgerPredicates({ type: "BUY,SELL", tkr: "LUCK", from: "2025-03-01" }),
    };
    expect(ids(matchRows(mixedTransactions, specWith, ""))).toEqual(["s1"]);
  });
});

describe("ledgerSpec search", () => {
  it("matches the note text", () => {
    const rows = [
      txn({ id: "a", date: "2025-01-01", type: "DEPOSIT", amount: 1, note: "salary transfer" }),
      txn({ id: "b", date: "2025-01-02", type: "DEPOSIT", amount: 1, note: "bonus" }),
    ];
    expect(ids(matchRows(rows, spec, "salary"))).toEqual(["a"]);
  });

  it("matches the company name, not just the ticker", () => {
    expect(ids(matchRows(mixedTransactions, spec, "lucky cement"))).toEqual(["b1"]);
  });

  it("matches a partial date, so a month narrows the ledger", () => {
    expect(ids(matchRows(mixedTransactions, spec, "2025-06"))).toEqual(["s1"]);
  });

  it("matches the type name", () => {
    expect(ids(matchRows(mixedTransactions, spec, "dividend"))).toEqual(["v2"]);
  });
});

describe("ledger columns", () => {
  it("sorts by date descending by default ordering", () => {
    const out = sortRows(mixedTransactions, spec, { key: "date", dir: "desc" });
    expect(ids(out)).toEqual(["s3", "v2", "s1", "b3", "b2", "b1", "d1"]);
  });

  it("sorts by value using the same rowValue the cell renders", () => {
    const out = sortRows(mixedTransactions, spec, { key: "value", dir: "desc" });
    const values = out.map((t) => rowValue(t));
    // Every non-null value in descending order, holes last.
    const nonNull = values.filter((v) => v > 0);
    expect(nonNull).toEqual([...nonNull].sort((a, b) => b - a));
  });

  it("pushes rows with no shares to the end, both directions", () => {
    // The DEPOSIT and the DIVIDEND both carry no share count — absent, not zero,
    // so they sit at the bottom whichever way the arrow points and keep their
    // input order relative to each other.
    for (const dir of ["asc", "desc"] as const) {
      const out = sortRows(mixedTransactions, spec, { key: "shares", dir });
      expect(ids(out.slice(-2)), dir).toEqual(["d1", "v2"]);
      // Everything above them has real shares.
      expect(out.slice(0, -2).every((t) => t.shares > 0), dir).toBe(true);
    }
  });

  it("sorts tickers ascending on first click", () => {
    const column = spec.columns.find((c) => c.key === "ticker");
    expect(column?.defaultDir).toBe("asc");
  });
});

describe("paging the ledger", () => {
  const many = Array.from({ length: 57 }, (_, i) =>
    txn({
      id: `t${i}`,
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      type: "BUY",
      ticker: "LUCK",
      shares: 1,
      price: 100 + i,
    }),
  );

  it("returns one page and reports the full matching total", () => {
    const out = view(many, { pageSize: 25 });
    expect(out.rows).toHaveLength(25);
    expect(out).toMatchObject({ total: 57, pageCount: 3, from: 1, to: 25 });
  });

  it("walks every row across pages exactly once", () => {
    const seen: string[] = [];
    for (let page = 1; page <= 3; page++) {
      seen.push(...ids(view(many, { pageSize: 25, page, sort: { key: "price", dir: "asc" } }).rows));
    }
    expect(seen).toHaveLength(57);
    expect(new Set(seen).size).toBe(57);
  });

  it("reports the filtered total, not the ledger size", () => {
    const mixed = [...many, txn({ id: "sell", date: "2025-02-01", type: "SELL", ticker: "LUCK", shares: 1, price: 200 })];
    const out = buildView(
      mixed,
      { ...spec, predicates: ledgerPredicates({ type: "SELL" }) },
      { query: "", sort: { key: null, dir: "desc" }, page: 1, pageSize: 25 },
    );
    expect(out.total).toBe(1);
    expect(ids(out.rows)).toEqual(["sell"]);
  });
});
