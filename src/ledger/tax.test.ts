import { describe, expect, it } from "vitest";
import { replayLedger } from "./replay";
import { DEFAULT_FEE_CONFIG } from "./feeConfig";
import { buildTaxYears, fiscalYearOf, fiscalYearRange } from "./tax";
import type { Transaction, TxnType } from "./types";

const cfg = DEFAULT_FEE_CONFIG;

let seq = 0;
function txn(type: TxnType, date: string, over: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `x${seq}`,
    date,
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

function years(txns: Transaction[]) {
  return buildTaxYears(replayLedger(txns, cfg), cfg);
}

describe("fiscal year", () => {
  it("starts a new year in July", () => {
    expect(fiscalYearOf("2025-06-30")).toBe("2024-25");
    expect(fiscalYearOf("2025-07-01")).toBe("2025-26");
    expect(fiscalYearOf("2026-01-15")).toBe("2025-26");
  });

  it("spans 1 July to 30 June", () => {
    expect(fiscalYearRange("2025-26")).toEqual({
      startDate: "2025-07-01",
      endDate: "2026-06-30",
    });
  });

  it("pads the second half of a century rollover", () => {
    expect(fiscalYearOf("2099-08-01")).toBe("2099-00");
  });
});

describe("gain / loss netting", () => {
  it("offsets a same-year loss against the year's gains", () => {
    const [fy] = years([
      txn("BUY", "2025-08-01", { shares: 100, price: 10000 }),
      txn("BUY", "2025-08-01", { shares: 100, price: 10000, ticker: "OGDC" }),
      txn("SELL", "2025-09-01", { shares: 100, price: 14000 }), // gain
      txn("SELL", "2025-09-02", { shares: 100, price: 9000, ticker: "OGDC" }), // loss
    ]);

    expect(fy.fy).toBe("2025-26");
    expect(fy.gains).toBeGreaterThan(0);
    expect(fy.losses).toBeGreaterThan(0);
    expect(fy.taxable).toBe(fy.gains - fy.offsetUsed);
    expect(fy.cgtDue).toBeLessThan(fy.cgtCharged);
    // NCCPL deducted on the winner without seeing the loser — expect a refund.
    expect(fy.cgtRefundable).toBeGreaterThan(0);
  });

  it("carries an unused loss forward and spends it the next year", () => {
    const out = years([
      txn("BUY", "2024-08-01", { shares: 100, price: 10000 }),
      txn("SELL", "2024-09-01", { shares: 100, price: 8000 }), // loss only
      txn("BUY", "2025-08-01", { shares: 100, price: 10000 }),
      txn("SELL", "2025-09-01", { shares: 100, price: 14000 }), // gain next year
    ]);

    expect(out.map((y) => y.fy)).toEqual(["2024-25", "2025-26"]);
    expect(out[0].taxable).toBe(0);
    expect(out[0].carryOut).toBeGreaterThan(0);
    expect(out[1].carryIn).toBe(out[0].carryOut);
    expect(out[1].offsetUsed).toBe(out[1].carryIn);
    expect(out[1].taxable).toBe(out[1].gains - out[1].carryIn);
  });

  it("expires a loss after three tax years", () => {
    const out = years([
      txn("BUY", "2020-08-01", { shares: 100, price: 10000 }),
      txn("SELL", "2020-09-01", { shares: 100, price: 8000 }), // FY2020-21 loss
      txn("BUY", "2025-08-01", { shares: 100, price: 10000 }),
      txn("SELL", "2025-09-01", { shares: 100, price: 14000 }), // FY2025-26 gain
    ]);
    const last = out[out.length - 1];

    expect(last.fy).toBe("2025-26");
    expect(last.carryIn).toBe(0);
    expect(last.taxable).toBe(last.gains);
  });

  it("fills the quiet years between activity so ageing is visible", () => {
    const out = years([
      txn("BUY", "2022-08-01", { shares: 100, price: 10000 }),
      txn("SELL", "2022-09-01", { shares: 100, price: 12000 }),
      txn("BUY", "2025-08-01", { shares: 100, price: 10000 }),
      txn("SELL", "2025-09-01", { shares: 100, price: 12000 }),
    ]);
    expect(out.map((y) => y.fy)).toEqual(["2022-23", "2023-24", "2024-25", "2025-26"]);
    expect(out[1].sales).toEqual([]);
  });
});

describe("rates", () => {
  it("blends the tiers actually used instead of assuming one rate", () => {
    const [fy] = years([
      txn("BUY", "2024-06-01", { shares: 100, price: 10000 }), // 12.5% tier
      txn("BUY", "2024-07-05", { shares: 100, price: 10000 }), // 15% tier
      txn("SELL", "2024-09-01", { shares: 200, price: 14000 }),
    ]);
    expect(fy.effectiveRatePct).toBeGreaterThan(12.5);
    expect(fy.effectiveRatePct).toBeLessThan(15);
  });

  it("falls back to the current rate in a year with no gains", () => {
    const [fy] = years([
      txn("BUY", "2025-08-01", { shares: 100, price: 10000 }),
      txn("SELL", "2025-09-01", { shares: 100, price: 8000 }),
    ]);
    expect(fy.effectiveRatePct).toBe(cfg.cgtRatePct);
    expect(fy.cgtDue).toBe(0);
  });
});

describe("other taxes", () => {
  it("buckets dividend withholding and bonus tax by fiscal year", () => {
    const out = years([
      txn("BUY", "2025-08-01", { shares: 100, price: 10000 }),
      txn("DIVIDEND", "2025-09-01", { price: 250 }),
      txn("BONUS", "2026-08-01", { shares: 20, price: 5000 }),
    ]);

    expect(out[0].fy).toBe("2025-26");
    expect(out[0].dividendGross).toBe(25_000);
    expect(out[0].dividendWht).toBe(3750);
    expect(out[0].bonusTax).toBe(0);

    expect(out[1].fy).toBe("2026-27");
    expect(out[1].bonusTax).toBe(10_000);
  });

  it("totals brokerage charged on the year's sales", () => {
    const [fy] = years([
      txn("BUY", "2025-08-01", { shares: 100, price: 10000 }),
      txn("SELL", "2025-09-01", { shares: 100, price: 12000 }),
    ]);
    expect(fy.sellFees).toBe(2672);
  });

  it("returns nothing for an empty ledger", () => {
    expect(years([])).toEqual([]);
  });
});
