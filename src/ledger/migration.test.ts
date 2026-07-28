// The opening-balance import has one job beyond creating lots: leave the cash
// account where it actually stands. Opening buys debit cash, so the deposit has
// to cover the capital already deployed — otherwise the account opens overdrawn
// by the cost of the whole portfolio.

import { describe, expect, it } from "vitest";
import { replayLedger } from "./replay";
import { deriveHoldings } from "./deriveHoldings";
import { DEFAULT_FEE_CONFIG } from "./feeConfig";
import type { Transaction } from "./types";
import type { Holding } from "../types";

const cfg = DEFAULT_FEE_CONFIG;

/** The real portfolio being migrated: paisa costs, as stored. */
const holdings: Holding[] = [
  { ticker: "KEL", shares: 100, costBasis: 714 },
  { ticker: "MLCF", shares: 40, costBasis: 9460 },
  { ticker: "EFERT", shares: 20, costBasis: 19_282 },
  { ticker: "PSO", shares: 50, costBasis: 35_376 },
  { ticker: "FFC", shares: 35, costBasis: 55_429 },
  { ticker: "SYS", shares: 250, costBasis: 15_000 },
].map((h, i) => ({
  id: `h${i}`,
  ticker: h.ticker,
  name: h.ticker,
  sector: "Misc",
  account: "PSX",
  shares: h.shares,
  price: h.costBasis,
  costBasis: h.costBasis,
  dayChangePct: 0,
  dividendPerShare: 0,
  payoutDate: "",
}));

const FREE_CASH = 870_300; // Rs 8,703.00

/** Mirrors what LedgerMigration builds when the user confirms. */
function openingDrafts(date: string, freeCash: number): Transaction[] {
  const deployed = holdings.reduce((sum, h) => sum + h.shares * h.costBasis, 0);
  const buys: Transaction[] = holdings.map((h, i) => ({
    id: `b${i}`,
    date,
    type: "BUY",
    ticker: h.ticker,
    name: h.name,
    sector: h.sector,
    shares: h.shares,
    price: h.costBasis,
    amount: 0,
    feeOverride: { total: 0 },
    note: "opening balance",
  }));
  return [
    {
      id: "dep",
      date,
      type: "DEPOSIT",
      ticker: "",
      name: "",
      sector: "",
      shares: 0,
      price: 0,
      amount: deployed + freeCash,
      note: "opening capital",
    },
    ...buys,
  ];
}

describe("opening-balance import", () => {
  const state = replayLedger(openingDrafts("2026-07-23", FREE_CASH), cfg);

  it("leaves cash at the free-cash figure, not overdrawn", () => {
    expect(state.cash).toBe(FREE_CASH);
    expect(state.issues).toEqual([]);
  });

  it("reproduces every position exactly as it was", () => {
    const derived = deriveHoldings(state);
    expect(derived).toHaveLength(6);
    for (const before of holdings) {
      const after = derived.find((h) => h.ticker === before.ticker)!;
      expect(after.shares).toBe(before.shares);
      // No fees charged on the opening buy, so the average cost is untouched.
      expect(after.costBasis).toBe(before.costBasis);
    }
  });

  it("keeps total cost equal to the pre-migration cost", () => {
    const before = holdings.reduce((sum, h) => sum + h.shares * h.costBasis, 0);
    const after = [...state.positions.values()].reduce((sum, p) => sum + p.cost, 0);
    expect(after).toBe(before);
  });

  it("opens at zero when there was no free cash", () => {
    const dry = replayLedger(openingDrafts("2026-07-23", 0), cfg);
    expect(dry.cash).toBe(0);
  });

  it("stays funded when the deposit is dated at the earliest buy", () => {
    // Deposit on the same day as (or before) the first buy — order within a day
    // follows entry order, and the deposit is written first.
    const txns = openingDrafts("2020-01-01", FREE_CASH);
    expect(replayLedger(txns, cfg).cash).toBe(FREE_CASH);
  });
});
