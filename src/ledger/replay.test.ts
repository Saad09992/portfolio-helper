import { describe, expect, it } from "vitest";
import { cgtRateFor, dayOf, replayLedger, sortTransactions } from "./replay";
import { DEFAULT_FEE_CONFIG } from "./feeConfig";
import type { Transaction, TxnType } from "./types";

const cfg = DEFAULT_FEE_CONFIG;

let seq = 0;
function txn(type: TxnType, date: string, over: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
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

function pos(state: ReturnType<typeof replayLedger>, ticker = "LUCK") {
  const p = state.positions.get(ticker);
  if (!p) throw new Error(`no position for ${ticker}`);
  return p;
}

describe("ordering", () => {
  it("replays by date, breaking ties on entry order", () => {
    const a = txn("BUY", "2025-03-02", { shares: 1, price: 100 });
    const b = txn("BUY", "2025-01-05", { shares: 2, price: 100 });
    const c = txn("BUY", "2025-03-02", { shares: 3, price: 100 });
    expect(sortTransactions([a, b, c]).map((t) => t.shares)).toEqual([2, 1, 3]);
  });

  it("reads a calendar day out of a full ISO timestamp", () => {
    expect(dayOf("2025-03-02T11:22:33.000Z")).toBe("2025-03-02");
  });
});

describe("BUY", () => {
  it("capitalizes fees into the lot cost and debits cash", () => {
    const state = replayLedger(
      [txn("BUY", "2025-01-10", { shares: 100, price: 10000 })],
      cfg,
    );
    const p = pos(state);

    // value 1,000,000 + fees 2,306
    // (1500 commission + 225 tax @15% + 0 cdc + 32 nccpl + 49 secp + 500 flat)
    expect(p.shares).toBe(100);
    expect(p.cost).toBe(1_002_306);
    expect(p.feesPaid).toBe(2306);
    expect(p.lots).toHaveLength(1);
    expect(state.cash).toBe(-1_002_306);
    expect(state.issues).toEqual([]);
  });

  it("rejects a non-positive share count", () => {
    const state = replayLedger([txn("BUY", "2025-01-10", { shares: 0, price: 10000 })], cfg);
    expect(state.issues).toHaveLength(1);
    expect(pos(state).shares).toBe(0);
  });
});

describe("SELL", () => {
  it("takes fees out of the proceeds but accrues CGT without touching cash", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("SELL", "2025-06-10", { shares: 100, price: 12000 }),
      ],
      cfg,
    );
    const p = pos(state);

    expect(p.shares).toBe(0);
    expect(p.cost).toBe(0);
    expect(p.lots).toHaveLength(0);
    expect(state.realized).toHaveLength(1);

    const slice = state.realized[0];
    expect(slice.proceeds).toBe(1_200_000);
    expect(slice.fees).toBe(2667);
    expect(slice.cost).toBe(1_002_306);
    expect(slice.gain).toBe(195_027);
    expect(slice.cgtRatePct).toBe(15);
    expect(slice.cgt).toBe(29_254);

    expect(p.realized).toBe(165_773); // gain − cgt
    expect(p.taxesPaid).toBe(29_254); // accrued, not paid

    // Cash matches what the broker credits: gross less brokerage, CGT untouched.
    // NCCPL collects centrally and only after netting the month's losses.
    expect(p.returned).toBe(1_200_000 - 2667);
    expect(state.cash).toBe(-1_002_306 + 1_197_333);
    expect(state.taxPayments).toEqual([]);
  });

  it("consumes lots oldest-first, slicing the partial lot's cost", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 1000 }),
        txn("BUY", "2025-02-10", { shares: 100, price: 2000 }),
        txn("SELL", "2025-06-10", { shares: 150, price: 4000 }),
      ],
      cfg,
    );
    const p = pos(state);

    expect(state.realized.map((r) => r.shares)).toEqual([100, 50]);
    expect(state.realized.map((r) => r.buyDate)).toEqual(["2025-01-10", "2025-02-10"]);
    expect(p.shares).toBe(50);
    expect(p.cost).toBe(100_430); // half of the second lot's remaining cost
    expect(p.lots).toHaveLength(1);
    expect(p.lots[0].date).toBe("2025-02-10");
    expect(p.realized).toBe(337_563);
  });

  it("books a loss with zero CGT", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("SELL", "2025-06-10", { shares: 100, price: 8000 }),
      ],
      cfg,
    );
    expect(state.realized[0].gain).toBeLessThan(0);
    expect(state.realized[0].cgt).toBe(0);
    expect(pos(state).realized).toBeLessThan(0);
  });

  it("rejects a sale beyond the shares held and leaves the position intact", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("SELL", "2025-06-10", { shares: 150, price: 12000 }),
      ],
      cfg,
    );
    expect(state.issues).toHaveLength(1);
    expect(state.issues[0].message).toMatch(/exceeds/);
    expect(pos(state).shares).toBe(100);
    expect(state.realized).toEqual([]);
  });

  it("conserves lot cost exactly across repeated awkward partial sells", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 377, price: 4931 }),
        txn("SELL", "2025-02-10", { shares: 113, price: 5100 }),
        txn("SELL", "2025-03-10", { shares: 131, price: 5200 }),
        txn("SELL", "2025-04-10", { shares: 133, price: 5300 }),
      ],
      cfg,
    );
    const p = pos(state);
    const buyCost = state.realized.reduce((s, r) => s + r.cost, 0);

    expect(p.shares).toBe(0);
    expect(p.cost).toBe(0);
    // Every paisa of the original lot ends up allocated to some slice.
    expect(buyCost).toBe(377 * 4931 + p.feesPaid - sellFees(state));
  });
});

/** Fees charged on the SELL side only — buy fees are inside the lot cost. */
function sellFees(state: ReturnType<typeof replayLedger>): number {
  const bySale = new Map<string, number>();
  for (const r of state.realized) {
    bySale.set(r.txnId, (bySale.get(r.txnId) ?? 0) + r.fees);
  }
  return [...bySale.values()].reduce((s, v) => s + v, 0);
}

describe("CGT tiers", () => {
  it("rates each slice by its own acquisition date", () => {
    const state = replayLedger(
      [
        txn("BUY", "2024-06-30", { shares: 100, price: 10000 }),
        txn("BUY", "2024-07-01", { shares: 100, price: 10000 }),
        txn("SELL", "2025-06-10", { shares: 200, price: 14000 }),
      ],
      cfg,
    );
    expect(state.realized.map((r) => r.cgtRatePct)).toEqual([12.5, 15]);
  });

  it("picks the legacy rate strictly before the cutoff", () => {
    expect(cgtRateFor("2024-06-30", cfg)).toBe(12.5);
    expect(cgtRateFor("2024-07-01", cfg)).toBe(15);
  });
});

describe("DIVIDEND", () => {
  it("credits cash net of withholding, using shares held", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("DIVIDEND", "2025-05-10", { price: 250 }),
      ],
      cfg,
    );
    const receipt = state.dividends[0];

    expect(receipt.gross).toBe(25_000);
    expect(receipt.wht).toBe(3750);
    expect(receipt.net).toBe(21_250);
    expect(pos(state).dividends).toBe(21_250);
    expect(pos(state).taxesPaid).toBe(3750);
  });

  it("prefers an explicit gross amount over dps × shares", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("DIVIDEND", "2025-05-10", { price: 250, amount: 30_000 }),
      ],
      cfg,
    );
    expect(state.dividends[0].gross).toBe(30_000);
  });

  it("skips a dividend with nothing to compute from", () => {
    const state = replayLedger([txn("DIVIDEND", "2025-05-10", { price: 250 })], cfg);
    expect(state.dividends).toEqual([]);
    expect(state.issues).toHaveLength(1);
  });
});

describe("BONUS", () => {
  it("adds zero-cost shares, taxes the issue value, and lowers average cost", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("BONUS", "2025-04-10", { shares: 20, price: 5000 }),
      ],
      cfg,
    );
    const p = pos(state);

    expect(p.shares).toBe(120);
    expect(p.cost).toBe(1_002_306); // unchanged — the shares were free
    expect(p.cost / p.shares).toBeLessThan(1_002_306 / 100);
    expect(state.bonusTaxes[0].value).toBe(100_000);
    expect(state.bonusTaxes[0].tax).toBe(10_000);
    expect(p.taxesPaid).toBe(10_000);
    expect(state.cash).toBe(-1_002_306 - 10_000);
  });

  it("dates the bonus lot at the issue, so it takes the current CGT tier", () => {
    const state = replayLedger(
      [
        txn("BUY", "2024-01-10", { shares: 100, price: 10000 }),
        txn("BONUS", "2025-04-10", { shares: 20, price: 5000 }),
      ],
      cfg,
    );
    expect(pos(state).lots.map((l) => l.date)).toEqual(["2024-01-10", "2025-04-10"]);
  });
});

describe("SPLIT", () => {
  it("rescales shares, preserves total cost and lot dates", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("SPLIT", "2025-04-10", { ratioFrom: 1, ratioTo: 5 }),
      ],
      cfg,
    );
    const p = pos(state);

    expect(p.shares).toBe(500);
    expect(p.cost).toBe(1_002_306);
    expect(p.lots[0].date).toBe("2025-01-10");
  });

  it("distributes the new share count across lots without drift", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 33, price: 10000 }),
        txn("BUY", "2025-02-10", { shares: 67, price: 10000 }),
        txn("SPLIT", "2025-04-10", { ratioFrom: 3, ratioTo: 7 }),
      ],
      cfg,
    );
    const p = pos(state);
    expect(p.shares).toBe(Math.round((100 * 7) / 3));
    expect(p.lots.reduce((s, l) => s + l.shares, 0)).toBe(p.shares);
  });

  it("rejects a zero ratio", () => {
    const state = replayLedger(
      [
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("SPLIT", "2025-04-10", { ratioFrom: 0, ratioTo: 5 }),
      ],
      cfg,
    );
    expect(state.issues).toHaveLength(1);
    expect(pos(state).shares).toBe(100);
  });
});

describe("RIGHT", () => {
  it("opens a lot at the subscription price with no brokerage", () => {
    const state = replayLedger(
      [txn("RIGHT", "2025-04-10", { shares: 50, price: 5000 })],
      cfg,
    );
    const p = pos(state);
    expect(p.shares).toBe(50);
    expect(p.cost).toBe(250_000);
    expect(p.feesPaid).toBe(0);
  });
});

describe("cash", () => {
  it("tracks deposits, withdrawals and trade flows together", () => {
    const state = replayLedger(
      [
        txn("DEPOSIT", "2025-01-01", { ticker: "", amount: 2_000_000 }),
        txn("BUY", "2025-01-10", { shares: 100, price: 10000 }),
        txn("WITHDRAW", "2025-02-01", { ticker: "", amount: 500_000 }),
      ],
      cfg,
    );
    expect(state.cash).toBe(2_000_000 - 1_002_306 - 500_000);
    expect(state.issues).toEqual([]);
  });

  it("flags a withdrawal that overdraws the account", () => {
    const state = replayLedger(
      [txn("WITHDRAW", "2025-02-01", { ticker: "", amount: 100 })],
      cfg,
    );
    expect(state.issues[0].message).toMatch(/negative/);
  });
});

describe("TAX", () => {
  it("debits cash and records the payment", () => {
    const state = replayLedger(
      [
        txn("DEPOSIT", "2025-01-01", { ticker: "", amount: 100_000 }),
        txn("TAX", "2025-10-15", { ticker: "", amount: 29_254, note: "NCCPL Sep" }),
      ],
      cfg,
    );

    expect(state.cash).toBe(100_000 - 29_254);
    expect(state.taxPayments).toEqual([
      { txnId: expect.any(String), date: "2025-10-15", amount: 29_254, note: "NCCPL Sep" },
    ]);
    expect(state.issues).toEqual([]);
  });

  it("needs no ticker", () => {
    const state = replayLedger(
      [
        txn("DEPOSIT", "2025-01-01", { ticker: "", amount: 100_000 }),
        txn("TAX", "2025-10-15", { ticker: "", amount: 5000 }),
      ],
      cfg,
    );
    expect(state.positions.size).toBe(0);
  });

  it("rejects a non-positive amount", () => {
    const state = replayLedger([txn("TAX", "2025-10-15", { ticker: "", amount: 0 })], cfg);
    expect(state.issues).toHaveLength(1);
    expect(state.taxPayments).toEqual([]);
  });

  it("flags a payment that overdraws the account", () => {
    const state = replayLedger([txn("TAX", "2025-10-15", { ticker: "", amount: 100 })], cfg);
    expect(state.issues[0].message).toMatch(/Tax payment takes the cash balance negative/);
  });
});
