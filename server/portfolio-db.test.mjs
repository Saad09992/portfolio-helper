import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "./migrations.mjs";
import { loadBundle, saveBundle } from "./portfolio-db.mjs";

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

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
  it("restores every field, including optional ones", () => {
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

    saveBundle(db, { ...baseBundle, transactions });
    const out = loadBundle(db);

    expect(out.transactions).toHaveLength(3);
    expect(out.transactions[0].ticker).toBe("LUCK"); // normalized on write
    expect(out.transactions[1]).toMatchObject({ ratioFrom: 1, ratioTo: 5 });
    expect(out.transactions[2].feeOverride).toEqual({ commission: 1234, total: 1500 });
    // Rows without the optional fields don't gain null placeholders.
    expect(out.transactions[0].ratioFrom).toBeUndefined();
    expect(out.transactions[0].feeOverride).toBeUndefined();
  });

  it("preserves entry order across a save/load cycle", () => {
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

    saveBundle(db, { ...baseBundle, transactions });
    expect(loadBundle(db).transactions.map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("full-replaces rather than appending", () => {
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

    saveBundle(db, { ...baseBundle, transactions: [one] });
    saveBundle(db, { ...baseBundle, transactions: [{ ...one, id: "t2" }] });

    expect(loadBundle(db).transactions.map((t) => t.id)).toEqual(["t2"]);
  });
});

describe("fee config round-trip", () => {
  it("stores and restores the rate set", () => {
    const db = freshDb();
    const feeConfig = { commissionPct: 0.2, cgtRatePct: 15, cgtLegacyCutoff: "2024-07-01" };

    saveBundle(db, { ...baseBundle, feeConfig });
    expect(loadBundle(db).feeConfig).toEqual(feeConfig);
  });

  it("returns null when none was ever saved", () => {
    const db = freshDb();
    saveBundle(db, baseBundle);
    expect(loadBundle(db).feeConfig).toBeNull();
  });
});

describe("backward compatibility", () => {
  it("accepts a pre-ledger bundle and reports an empty ledger", () => {
    const db = freshDb();
    saveBundle(db, baseBundle); // no transactions / feeConfig keys at all
    const out = loadBundle(db);

    expect(out.transactions).toEqual([]);
    expect(out.feeConfig).toBeNull();
    expect(out.savedAt).toBe(baseBundle.savedAt);
  });

  it("still returns null for a database nothing has been saved to", () => {
    expect(loadBundle(freshDb())).toBeNull();
  });
});
