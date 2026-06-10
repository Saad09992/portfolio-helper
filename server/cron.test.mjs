import { describe, expect, it } from "vitest";
import { quoteFreshness } from "./cron.mjs";

describe("quoteFreshness", () => {
  // 2026-06-10 15:30 PKT = 2026-06-10 10:30 UTC
  const closeMs = Date.UTC(2026, 5, 10, 10, 30, 0);

  it("classifies a quote with asOf at the close as fresh", () => {
    const r = quoteFreshness(
      [{ ticker: "A", current: 100, changePct: 0, asOf: "2026-06-10T10:30:00.000Z" }],
      closeMs,
    );
    expect(r.fresh).toHaveLength(1);
    expect(r.stale).toHaveLength(0);
  });

  it("classifies a quote with asOf before the close as stale", () => {
    const r = quoteFreshness(
      [{ ticker: "A", current: 100, changePct: 0, asOf: "2026-06-10T10:29:59.999Z" }],
      closeMs,
    );
    expect(r.stale).toHaveLength(1);
    expect(r.fresh).toHaveLength(0);
  });

  it("treats null / missing asOf as stale", () => {
    const r = quoteFreshness(
      [
        { ticker: "A", current: 100, changePct: 0, asOf: null },
        { ticker: "B", current: 50, changePct: 0 },
      ],
      closeMs,
    );
    expect(r.stale).toHaveLength(2);
    expect(r.fresh).toHaveLength(0);
  });

  it("treats unparseable asOf as stale", () => {
    const r = quoteFreshness(
      [{ ticker: "A", current: 100, changePct: 0, asOf: "not-an-iso" }],
      closeMs,
    );
    expect(r.stale).toHaveLength(1);
  });

  it("handles mixed fresh and stale", () => {
    const r = quoteFreshness(
      [
        { ticker: "A", asOf: "2026-06-10T11:00:00Z" },
        { ticker: "B", asOf: "2026-06-10T09:00:00Z" },
        { ticker: "C", asOf: "2026-06-10T10:30:00Z" },
      ],
      closeMs,
    );
    expect(r.fresh.map((q) => q.ticker)).toEqual(["A", "C"]);
    expect(r.stale.map((q) => q.ticker)).toEqual(["B"]);
  });

  it("returns all stale when closeMs is NaN", () => {
    const r = quoteFreshness(
      [{ ticker: "A", asOf: "2026-06-10T11:00:00Z" }],
      NaN,
    );
    expect(r.stale).toHaveLength(1);
    expect(r.fresh).toHaveLength(0);
  });
});
