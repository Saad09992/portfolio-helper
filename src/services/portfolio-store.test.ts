import { describe, expect, it } from "vitest";
import { mergeHistory } from "./portfolio-store";

// mergeHistory reconciles a save conflict. Dropping either side loses real
// data: the server may hold nights only the cron saw, and the tab may hold days
// the server does not have yet.
describe("mergeHistory", () => {
  const snap = (date: string, totalValue: number) => ({
    date,
    totalValue,
    totalCost: 0,
    gainLoss: 0,
  });

  it("keeps entries unique to either side", () => {
    const mine = [snap("2026-08-10T18:59:00.000Z", 1)];
    const theirs = [snap("2026-08-11T18:59:00.000Z", 2)];

    expect(mergeHistory(mine, theirs).map((s) => s.totalValue)).toEqual([1, 2]);
  });

  it("keeps one entry per PKT date, preferring the later recording", () => {
    // Same PKT day, different times: 22:34 PKT and 23:59 PKT.
    const mine = [snap("2026-08-11T17:34:58.000Z", 1)];
    const theirs = [snap("2026-08-11T18:59:47.000Z", 2)];

    const out = mergeHistory(mine, theirs);
    expect(out).toHaveLength(1);
    expect(out[0].totalValue).toBe(2);
  });

  it("prefers the local entry when it is the later of the two", () => {
    // Both inside PKT 2026-08-11 (22:00 and 23:00 PKT). Note the +5h shift:
    // anything from 19:00Z onward is already the next PKT date.
    const mine = [snap("2026-08-11T18:00:00.000Z", 9)];
    const theirs = [snap("2026-08-11T17:00:00.000Z", 2)];

    const out = mergeHistory(mine, theirs);
    expect(out).toHaveLength(1);
    expect(out[0].totalValue).toBe(9);
  });

  it("returns entries sorted by date", () => {
    const mine = [snap("2026-08-12T18:59:00.000Z", 3), snap("2026-08-10T18:59:00.000Z", 1)];
    const theirs = [snap("2026-08-11T18:59:00.000Z", 2)];

    expect(mergeHistory(mine, theirs).map((s) => s.totalValue)).toEqual([1, 2, 3]);
  });

  it("tolerates missing, non-array and malformed input", () => {
    expect(mergeHistory(undefined, undefined)).toEqual([]);
    expect(mergeHistory(null, "nonsense")).toEqual([]);
    expect(mergeHistory([{ totalValue: 1 }], [snap("2026-08-11T18:59:00.000Z", 2)])).toHaveLength(1);
  });

  it("does not lose the cron's night when the tab has none", () => {
    const theirs = [snap("2026-08-11T18:59:47.000Z", 99)];
    expect(mergeHistory([], theirs)).toHaveLength(1);
  });
});
