// End-to-end coverage of runDailySync's freshness decision, with the network
// and the clock mocked so the outcome is deterministic.
//
// The relaxed branch matters disproportionately: if it regresses, the cron
// silently stops snapshotting and the only symptom is history that quietly
// stops growing. That is exactly the failure a unit test should catch.

import { beforeEach, describe, expect, it, vi } from "vitest";

const quotes = vi.hoisted(() => ({ value: [] }));
const kse = vi.hoisted(() => ({ value: { current: 180000, source: "psx-www" } }));
const closeStatus = vi.hoisted(() => ({
  value: { isWeekday: true, afterClose: true, pkDate: "2026-06-10" },
}));

vi.mock("./api.mjs", () => ({
  fetchQuoteResilient: vi.fn(async (ticker) =>
    quotes.value.find((q) => q.ticker === ticker) ?? null,
  ),
  serializeSave: (work) => work(),
}));

vi.mock("./psx-index.mjs", () => ({
  fetchKse100: vi.fn(async () => kse.value),
}));

vi.mock("./portfolio-compute.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, psxCloseStatus: () => closeStatus.value };
});

const { runDailySync } = await import("./cron.mjs");
const { freshTestDb } = await import("./local-db.mjs");
const { loadBundle, saveBundle } = await import("./portfolio-db.mjs");

// 2026-06-10 15:30 PKT close = 10:30 UTC.
const PRE_CLOSE = "2026-06-10T07:17:29.188Z";
const POST_CLOSE = "2026-06-10T11:00:00.000Z";

const holdings = [
  {
    id: "h1",
    ticker: "PSO",
    name: "",
    sector: "",
    account: "",
    shares: 10,
    price: 35000,
    costBasis: 30000,
    dayChangePct: 0,
    dividendPerShare: 0,
    payoutDate: "",
  },
  {
    id: "h2",
    ticker: "SYS",
    name: "",
    sector: "",
    account: "",
    shares: 20,
    price: 13000,
    costBasis: 12000,
    dayChangePct: 0,
    dividendPerShare: 0,
    payoutDate: "",
  },
];

async function seeded() {
  const db = freshTestDb();
  await saveBundle(db, {
    holdings,
    cash: { available: 0 },
    targets: [],
    investments: [],
    transactions: [],
    history: [],
    lastFetchedAt: null,
    savedAt: "2026-06-09T00:00:00.000Z",
  });
  return db;
}

const quote = (ticker, source, asOf, current) => ({
  ticker,
  current,
  changePct: 1,
  asOf,
  source,
});

beforeEach(() => {
  closeStatus.value = { isWeekday: true, afterClose: true, pkDate: "2026-06-10" };
  kse.value = { current: 180000, source: "psx-www" };
});

describe("runDailySync freshness handling", () => {
  it("snapshots normally when primary quotes are settled", async () => {
    quotes.value = [
      quote("PSO", "dps", POST_CLOSE, 360),
      quote("SYS", "dps", POST_CLOSE, 140),
    ];
    const db = await seeded();

    const res = await runDailySync({ db, force: true, log: () => {} });

    expect(res.ran).toBe(true);
    expect(res.freshnessRule).toBe("strict");
    expect((await loadBundle(db)).history).toHaveLength(1);
  });

  it("skips when primary quotes are stale — does not record pre-close prices", async () => {
    quotes.value = [
      quote("PSO", "dps", PRE_CLOSE, 360),
      quote("SYS", "dps", PRE_CLOSE, 140),
    ];
    const db = await seeded();

    const res = await runDailySync({ db, force: true, log: () => {} });

    expect(res.ran).toBe(false);
    expect(res.reason).toBe("quotes-stale");
    expect((await loadBundle(db)).history).toHaveLength(0);
  });

  // The steady state once dps is unreachable from Cloudflare: every quote comes
  // from sarmaaya, whose asOf is a shared refresh stamp that can sit before the
  // close. Strict rules would skip here every single night.
  it("snapshots via the relaxed rule when every quote is from a fallback", async () => {
    quotes.value = [
      quote("PSO", "sarmaaya", PRE_CLOSE, 360),
      quote("SYS", "sarmaaya", PRE_CLOSE, 140),
    ];
    const db = await seeded();

    const res = await runDailySync({ db, force: true, log: () => {} });

    expect(res.ran).toBe(true);
    expect(res.freshnessRule).toBe("relaxed-fallback");

    const history = (await loadBundle(db)).history;
    expect(history).toHaveLength(1);
    // Prices are stored as integer paisa.
    expect(history[0].shares).toEqual({ PSO: 10, SYS: 20 });
    expect(history[0].kse100).toBe(180000);
  });

  it("logs that the relaxed rule was applied rather than doing it silently", async () => {
    quotes.value = [
      quote("PSO", "sarmaaya", PRE_CLOSE, 360),
      quote("SYS", "sarmaaya", PRE_CLOSE, 140),
    ];
    const db = await seeded();
    const lines = [];

    await runDailySync({ db, force: true, log: (m) => lines.push(String(m)) });

    expect(lines.join("\n")).toMatch(/RELAXED/);
    expect(lines.join("\n")).toMatch(/sarmaaya/);
  });

  // Known gap, deliberately not relaxed: a mixed run means at least one primary
  // quote exists, so the shared-stamp justification does not apply. Documented
  // in DEPLOY_CLOUDFLARE.md so it isn't mistaken for an oversight.
  it("stays strict when sources are mixed", async () => {
    quotes.value = [
      quote("PSO", "dps", POST_CLOSE, 360),
      quote("SYS", "sarmaaya", PRE_CLOSE, 140),
    ];
    const db = await seeded();

    const res = await runDailySync({ db, force: true, log: () => {} });

    expect(res.ran).toBe(false);
    expect(res.reason).toBe("quotes-stale");
  });

  it("ignores the freshness gate entirely on non-trading days", async () => {
    closeStatus.value = { isWeekday: false, afterClose: true, pkDate: "2026-06-13" };
    quotes.value = [
      quote("PSO", "sarmaaya", PRE_CLOSE, 360),
      quote("SYS", "sarmaaya", PRE_CLOSE, 140),
    ];
    const db = await seeded();

    const res = await runDailySync({ db, force: true, log: () => {} });

    expect(res.ran).toBe(true);
    expect(res.freshnessRule).toBe("not-applicable");
  });

  it("still records a snapshot when the KSE100 lookup fails entirely", async () => {
    kse.value = null;
    quotes.value = [
      quote("PSO", "sarmaaya", PRE_CLOSE, 360),
      quote("SYS", "sarmaaya", PRE_CLOSE, 140),
    ];
    const db = await seeded();

    const res = await runDailySync({ db, force: true, log: () => {} });

    expect(res.ran).toBe(true);
    expect((await loadBundle(db)).history[0].kse100).toBeUndefined();
  });

  it("refuses to snapshot when no quotes come back at all", async () => {
    quotes.value = [];
    const db = await seeded();

    const res = await runDailySync({ db, force: true, log: () => {} });

    expect(res.ran).toBe(false);
    expect(res.reason).toBe("no-quotes");
  });
});
