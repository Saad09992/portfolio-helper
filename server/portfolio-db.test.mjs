import { describe, expect, it } from "vitest";
import { freshTestDb } from "./local-db.mjs";
import { loadBundle, saveBundle } from "./portfolio-db.mjs";

const freshDb = freshTestDb;

const baseBundle = {
  holdings: [],
  cash: { available: 0 },
  targets: [],
  investments: [],
  history: [],
  lastFetchedAt: null,
  savedAt: "2026-07-23T00:00:00.000Z",
};

describe("transaction round-trip", () => {
  it("restores every field, including optional ones", async () => {
    const db = freshDb();
    const transactions = [
      {
        id: "t1",
        date: "2025-01-10",
        type: "BUY",
        ticker: "luck",
        name: "Lucky Cement",
        sector: "Materials",
        shares: 100,
        price: 14500,
        amount: 0,
        note: "opening balance",
      },
      {
        id: "t2",
        date: "2025-04-10",
        type: "SPLIT",
        ticker: "LUCK",
        name: "",
        sector: "",
        shares: 0,
        price: 0,
        amount: 0,
        ratioFrom: 1,
        ratioTo: 5,
        note: "",
      },
      {
        id: "t3",
        date: "2025-06-10",
        type: "SELL",
        ticker: "LUCK",
        name: "",
        sector: "",
        shares: 50,
        price: 16000,
        amount: 0,
        feeOverride: { commission: 1234, total: 1500 },
        note: "matched to broker note",
      },
    ];

    await saveBundle(db, { ...baseBundle, transactions });
    const out = await loadBundle(db);

    expect(out.transactions).toHaveLength(3);
    expect(out.transactions[0].ticker).toBe("LUCK"); // normalized on write
    expect(out.transactions[1]).toMatchObject({ ratioFrom: 1, ratioTo: 5 });
    expect(out.transactions[2].feeOverride).toEqual({ commission: 1234, total: 1500 });
    // Rows without the optional fields don't gain null placeholders.
    expect(out.transactions[0].ratioFrom).toBeUndefined();
    expect(out.transactions[0].feeOverride).toBeUndefined();
  });

  it("preserves entry order across a save/load cycle", async () => {
    const db = freshDb();
    const transactions = ["a", "b", "c", "d"].map((id, i) => ({
      id,
      date: "2025-01-10", // same day — order is the only tiebreak
      type: "BUY",
      ticker: "LUCK",
      name: "",
      sector: "",
      shares: i + 1,
      price: 100,
      amount: 0,
      note: "",
    }));

    await saveBundle(db, { ...baseBundle, transactions });
    const out = await loadBundle(db);
    expect(out.transactions.map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("full-replaces rather than appending", async () => {
    const db = freshDb();
    const one = {
      id: "t1",
      date: "2025-01-10",
      type: "BUY",
      ticker: "LUCK",
      name: "",
      sector: "",
      shares: 1,
      price: 100,
      amount: 0,
      note: "",
    };

    await saveBundle(db, { ...baseBundle, transactions: [one] });
    await saveBundle(db, { ...baseBundle, transactions: [{ ...one, id: "t2" }] });

    const out = await loadBundle(db);
    expect(out.transactions.map((t) => t.id)).toEqual(["t2"]);
  });
});

describe("fee config round-trip", () => {
  it("stores and restores the rate set", async () => {
    const db = freshDb();
    const feeConfig = { commissionPct: 0.2, cgtRatePct: 15, cgtLegacyCutoff: "2024-07-01" };

    await saveBundle(db, { ...baseBundle, feeConfig });
    expect((await loadBundle(db)).feeConfig).toEqual(feeConfig);
  });

  it("returns null when none was ever saved", async () => {
    const db = freshDb();
    await saveBundle(db, baseBundle);
    expect((await loadBundle(db)).feeConfig).toBeNull();
  });
});

describe("backward compatibility", () => {
  it("accepts a pre-ledger bundle and reports an empty ledger", async () => {
    const db = freshDb();
    await saveBundle(db, baseBundle); // no transactions / feeConfig keys at all
    const out = await loadBundle(db);

    expect(out.transactions).toEqual([]);
    expect(out.feeConfig).toBeNull();
    expect(out.savedAt).toBe(baseBundle.savedAt);
  });

  it("still returns null for a database nothing has been saved to", async () => {
    expect(await loadBundle(freshDb())).toBeNull();
  });
});

// D1 has no named parameters, so every INSERT binds positionally. A transposed
// argument would still be a valid write — same arity, same types — and would
// corrupt data with no error. These assert values land in the column they were
// meant for, using distinct values per field so a swap can't pass by accident.
describe("positional bind integrity", () => {
  it("round-trips a holding with every column distinct", async () => {
    const db = freshDb();
    const holding = {
      id: "h1",
      ticker: "PSO",
      name: "Pakistan State Oil",
      sector: "Energy",
      account: "CDC-123",
      shares: 11,
      price: 22,
      costBasis: 33,
      dayChangePct: 44,
      dividendPerShare: 55,
      payoutDate: "2026-01-15",
    };

    await saveBundle(db, { ...baseBundle, holdings: [holding] });
    const out = await loadBundle(db);

    expect(out.holdings).toHaveLength(1);
    expect(out.holdings[0]).toMatchObject(holding);
  });

  it("round-trips payouts attached to their holding", async () => {
    const db = freshDb();
    const holdings = [
      {
        id: "h1",
        ticker: "PSO",
        name: "",
        sector: "",
        account: "",
        shares: 1,
        price: 1,
        costBasis: 1,
        dayChangePct: 0,
        dividendPerShare: 0,
        payoutDate: "",
        payouts: [
          {
            announcementDate: "2026-02-01",
            bookClosureDate: "2026-02-20",
            dividendPerShare: 750,
          },
          {
            announcementDate: "2026-05-01",
            bookClosureDate: "2026-05-20",
            dividendPerShare: 900,
          },
        ],
      },
    ];

    await saveBundle(db, { ...baseBundle, holdings });
    const out = await loadBundle(db);

    expect(out.holdings[0].payouts).toEqual(holdings[0].payouts);
  });

  it("round-trips a target including its nullable columns", async () => {
    const db = freshDb();
    const targets = [
      {
        id: "tg1",
        mode: "sector",
        key: "Energy",
        targetWeight: 25,
        warnThreshold: 5,
        criticalThreshold: 10,
        cadence: "quarterly",
        lastRebalancedAt: "2026-03-01",
      },
      // Nullable fields omitted — must not reappear as nulls.
      { id: "tg2", mode: "ticker", key: "PSO", targetWeight: 10 },
    ];

    await saveBundle(db, { ...baseBundle, targets });
    const out = await loadBundle(db);

    expect(out.targets[0]).toMatchObject(targets[0]);
    expect(out.targets[1].warnThreshold).toBeUndefined();
    expect(out.targets[1].cadence).toBeUndefined();
    expect(out.targets[1].lastRebalancedAt).toBeNull();
  });

  it("round-trips investments and cash", async () => {
    const db = freshDb();
    const investments = [
      { id: "i1", date: "2026-01-31", label: "January", amount: 1000, valueEom: 2000 },
    ];

    await saveBundle(db, {
      ...baseBundle,
      investments,
      cash: { available: 4242 },
    });
    const out = await loadBundle(db);

    expect(out.investments).toEqual(investments);
    expect(out.cash.available).toBe(4242);
  });

  it("round-trips history including kse100 and the shares map", async () => {
    const db = freshDb();
    const history = [
      {
        date: "2026-08-04",
        totalValue: 100,
        totalCost: 90,
        gainLoss: 10,
        kse100: 180014.93,
        shares: { PSO: 5, SYS: 7 },
      },
      // No kse100 / shares — must stay absent rather than becoming null.
      { date: "2026-08-05", totalValue: 200, totalCost: 150, gainLoss: 50 },
    ];

    await saveBundle(db, { ...baseBundle, history });
    const out = await loadBundle(db);

    expect(out.history[0]).toMatchObject(history[0]);
    expect(out.history[1].kse100).toBeUndefined();
    expect(out.history[1].shares).toBeUndefined();
  });

  it("keeps lastFetchedAt distinct from savedAt", async () => {
    const db = freshDb();
    await saveBundle(db, {
      ...baseBundle,
      lastFetchedAt: "2026-08-05T10:00:00.000Z",
      savedAt: "2026-08-06T11:00:00.000Z",
    });
    const out = await loadBundle(db);

    expect(out.lastFetchedAt).toBe("2026-08-05T10:00:00.000Z");
    expect(out.savedAt).toBe("2026-08-06T11:00:00.000Z");
  });
});
