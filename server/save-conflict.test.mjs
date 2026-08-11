// Optimistic concurrency on /api/portfolio/save.
//
// Guards the failure that made the nightly cron pointless: saves are
// whole-bundle full-replace, so a browser tab holding a pre-cron copy would
// push it back over the snapshot the cron had just written, with no error and
// no trace beyond a missing history row.

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { registerApiRoutes } from "./api.mjs";
import { freshTestDb } from "./local-db.mjs";
import { loadBundle, saveBundle } from "./portfolio-db.mjs";

const bundleAt = (savedAt, history = []) => ({
  holdings: [],
  cash: { available: 0 },
  targets: [],
  investments: [],
  transactions: [],
  history,
  lastFetchedAt: null,
  savedAt,
});

function appFor(db) {
  const app = new Hono();
  registerApiRoutes(app, { getDb: () => db, getStocks: () => [] });
  return app;
}

const save = (app, bundle, base) =>
  app.request("/api/portfolio/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(base ? { "X-PSX-Base-SavedAt": base } : {}),
    },
    body: JSON.stringify(bundle),
  });

describe("save conflict detection", () => {
  it("accepts a save whose base version matches the stored one", async () => {
    const db = freshTestDb();
    await saveBundle(db, bundleAt("v1"));
    const res = await save(appFor(db), bundleAt("v2"), "v1");

    expect(res.status).toBe(200);
    expect((await loadBundle(db)).savedAt).toBe("v2");
  });

  it("rejects a save built on a stale version and leaves the stored copy alone", async () => {
    const db = freshTestDb();
    await saveBundle(db, bundleAt("v1"));
    await saveBundle(db, bundleAt("v2")); // e.g. the cron writing at 23:59

    const res = await save(appFor(db), bundleAt("v3"), "v1");

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("conflict");
    expect(body.currentSavedAt).toBe("v2");
    // The stored bundle must be untouched by a refused write.
    expect((await loadBundle(db)).savedAt).toBe("v2");
  });

  it("returns the current bundle with the conflict so the client can merge", async () => {
    const db = freshTestDb();
    await saveBundle(db, bundleAt("v1"));
    await saveBundle(
      db,
      bundleAt("v2", [{ date: "2026-08-11T18:59:00.000Z", totalValue: 5, totalCost: 4, gainLoss: 1 }]),
    );

    const res = await save(appFor(db), bundleAt("v3"), "v1");
    const body = await res.json();

    expect(body.bundle.history).toHaveLength(1);
    expect(body.bundle.history[0].totalValue).toBe(5);
  });

  it("still accepts a client that sends no base version", async () => {
    // An older tab loaded before this shipped must degrade to the previous
    // behaviour rather than becoming unable to save at all.
    const db = freshTestDb();
    await saveBundle(db, bundleAt("v1"));

    const res = await save(appFor(db), bundleAt("v2"), null);

    expect(res.status).toBe(200);
    expect((await loadBundle(db)).savedAt).toBe("v2");
  });

  it("accepts the first write when nothing is stored yet", async () => {
    const db = freshTestDb();
    const res = await save(appFor(db), bundleAt("v1"), "anything");
    expect(res.status).toBe(200);
  });

  // The scenario from production, end to end.
  it("prevents a stale tab from erasing the cron's snapshot", async () => {
    const db = freshTestDb();
    const cronNight = { date: "2026-08-11T18:59:47.000Z", totalValue: 99, totalCost: 90, gainLoss: 9 };

    // 22:34 — the tab saves and holds this version.
    await saveBundle(db, bundleAt("22:34", []));
    // 23:59 — the cron writes its snapshot.
    await saveBundle(db, bundleAt("23:59", [cronNight]));
    // 00:28 — the tab saves again, still based on its 22:34 copy.
    const res = await save(appFor(db), bundleAt("00:28", []), "22:34");

    expect(res.status).toBe(409);
    const stored = await loadBundle(db);
    expect(stored.history).toHaveLength(1);
    expect(stored.history[0].totalValue).toBe(99);
  });
});
