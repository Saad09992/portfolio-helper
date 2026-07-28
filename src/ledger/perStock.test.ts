import { describe, expect, it } from "vitest";
import { replayLedger } from "./replay";
import { DEFAULT_FEE_CONFIG } from "./feeConfig";
import { averageCost, deriveHoldings, ledgerTotals } from "./deriveHoldings";
import { buildStockRows, daysBetween, estimateExitCosts } from "./perStock";
import type { Transaction, TxnType } from "./types";
import type { Holding } from "../types";

const cfg = DEFAULT_FEE_CONFIG;

let seq = 0;
function txn(type: TxnType, date: string, over: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `p${seq}`,
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

const openPosition = () =>
  replayLedger([txn("BUY", "2025-01-10", { shares: 100, price: 10000 })], cfg);

describe("deriveHoldings", () => {
  it("maps an open position onto the Holding shape", () => {
    const holdings = deriveHoldings(openPosition());
    expect(holdings).toHaveLength(1);
    expect(holdings[0]).toMatchObject({
      ticker: "LUCK",
      name: "Lucky Cement",
      sector: "Materials",
      shares: 100,
      costBasis: 10_023, // (1,000,000 + 2,310) / 100 → 10,023.1 → 10,023
      account: "PSX",
    });
  });

  it("keeps market data from the previously stored row", () => {
    const prior: Holding = {
      id: "existing-1",
      ticker: "LUCK",
      name: "Lucky Cement",
      sector: "Materials",
      account: "PSX",
      shares: 999,
      price: 12_500,
      costBasis: 1,
      dayChangePct: 2.4,
      dividendPerShare: 300,
      payoutDate: "2026-01-01",
    };
    const [holding] = deriveHoldings(openPosition(), [prior]);

    expect(holding.id).toBe("existing-1");
    expect(holding.price).toBe(12_500);
    expect(holding.dayChangePct).toBe(2.4);
    expect(holding.dividendPerShare).toBe(300);
    // Ledger wins on the position itself.
    expect(holding.shares).toBe(100);
    expect(holding.costBasis).toBe(10_023);
  });

  it("prices a never-quoted position at its average cost", () => {
    expect(deriveHoldings(openPosition())[0].price).toBe(10_023);
  });

  it("drops fully closed positions from holdings", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("SELL", "2025-06-10", { shares: 100, price: 12000 }),
      ],
      cfg,
    );
    expect(deriveHoldings(state)).toEqual([]);
  });

  it("ignores the synthetic cash row when reusing prior data", () => {
    const cash: Holding = {
      id: "cash-available",
      ticker: "CASH",
      name: "Available Cash",
      sector: "Cash",
      account: "Cash",
      shares: 1,
      price: 5000,
      costBasis: 5000,
      dayChangePct: 0,
      dividendPerShare: 0,
      payoutDate: "",
    };
    expect(deriveHoldings(openPosition(), [cash]).map((h) => h.ticker)).toEqual(["LUCK"]);
  });
});

describe("ledgerTotals", () => {
  it("reports exact cost, not shares × rounded average", () => {
    const state = replayLedger(
      [txn("BUY", "2025-01-10", { shares: 377, price: 4931 })],
      cfg,
    );
    const position = state.positions.get("LUCK")!;
    const totals = ledgerTotals(state, new Map([["LUCK", 5000]]));

    expect(totals.openCost).toBe(position.cost);
    expect(totals.marketValue).toBe(377 * 5000);
    expect(totals.unrealized).toBe(377 * 5000 - position.cost);
    // The rounded per-share average would have drifted from the true cost.
    expect(377 * averageCost(position)).not.toBe(position.cost);
  });
});

describe("estimateExitCosts", () => {
  it("prices brokerage plus CGT on every open lot", () => {
    const state = replayLedger(
      [
        txn("BUY", "2024-06-30", { shares: 100, price: 10000 }),
        txn("BUY", "2024-07-01", { shares: 100, price: 10000 }),
      ],
      cfg,
    );
    const exit = estimateExitCosts(state.positions.get("LUCK")!, 14000, cfg);

    expect(exit.fees).toBeGreaterThan(0);
    expect(exit.cgt).toBeGreaterThan(0);
  });

  it("charges no CGT when the position is under water", () => {
    const exit = estimateExitCosts(openPosition().positions.get("LUCK")!, 8000, cfg);
    expect(exit.cgt).toBe(0);
    expect(exit.fees).toBeGreaterThan(0);
  });

  it("is free to exit nothing", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("SELL", "2025-06-10", { shares: 100, price: 12000 }),
      ],
      cfg,
    );
    expect(estimateExitCosts(state.positions.get("LUCK")!, 12000, cfg)).toEqual({
      fees: 0,
      cgt: 0,
    });
  });
});

describe("buildStockRows", () => {
  const state = replayLedger(
    [
      txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
      txn("BUY", "2025-02-10", { shares: 100, price: 11000 }),
      txn("SELL", "2025-06-10", { shares: 100, price: 12000 }),
      txn("DIVIDEND", "2025-07-10", { price: 250 }),
    ],
    cfg,
  );
  const rows = buildStockRows(state, new Map([["LUCK", 13000]]), cfg, "2026-01-10");
  const row = rows[0];

  it("returns one row per traded ticker", () => {
    expect(rows).toHaveLength(1);
    expect(row.ticker).toBe("LUCK");
    expect(row.isClosed).toBe(false);
  });

  it("adds realized, unrealized and dividends into the headline", () => {
    expect(row.totalNet).toBe(row.realized + row.unrealized + row.dividends);
    expect(row.realized).toBeGreaterThan(0);
    expect(row.dividends).toBeGreaterThan(0);
  });

  it("subtracts estimated exit costs for the net-if-sold figure", () => {
    expect(row.netIfSoldToday).toBe(row.unrealized - row.exitFees - row.exitCgt);
    expect(row.netIfSoldToday).toBeLessThan(row.unrealized);
  });

  it("reports fee drag against lifetime cash invested", () => {
    expect(row.feeDragPct).toBeCloseTo(
      ((row.feesPaid + row.taxesPaid) / row.invested) * 100,
      10,
    );
  });

  it("counts closed slices and win rate", () => {
    expect(row.closed.count).toBe(1);
    expect(row.closed.wins).toBe(1);
    expect(row.closed.winRatePct).toBe(100);
  });

  it("weights holding period by shares across open lots", () => {
    // 100 shares left, all from the 2025-02-10 lot after FIFO consumed the first.
    expect(row.holdingDays).toBe(daysBetween("2025-02-10", "2026-01-10"));
  });

  it("keeps contributions on a comparable scale across stocks", () => {
    const two = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("BUY", "2025-01-10", { shares: 100, price: 10000, ticker: "OGDC", name: "OGDC" }),
      ],
      cfg,
    );
    const out = buildStockRows(
      two,
      new Map([
        ["LUCK", 12000],
        ["OGDC", 9000],
      ]),
      cfg,
      "2026-01-10",
    );
    const sum = out.reduce((s, r) => s + Math.abs(r.contributionPct), 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it("keeps a fully closed position with its realized P&L", () => {
    const closed = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("SELL", "2025-06-10", { shares: 100, price: 12000 }),
      ],
      cfg,
    );
    const [only] = buildStockRows(closed, new Map(), cfg, "2026-01-10");
    expect(only.isClosed).toBe(true);
    expect(only.shares).toBe(0);
    expect(only.unrealized).toBe(0);
    expect(only.realized).toBeGreaterThan(0);
    expect(only.totalNet).toBe(only.realized);
  });
});
