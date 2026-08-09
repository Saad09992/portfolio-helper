import { describe, expect, it } from "vitest";
import {
  allocationTotal,
  buildAllocationSlices,
  valueFor,
  weightFor,
  type AllocationInput,
} from "./allocation";

const holdings: AllocationInput[] = [
  { ticker: "LUCK", sector: "Cement", marketValue: 40_000, costValue: 20_000 },
  { ticker: "MLCF", sector: "Cement", marketValue: 10_000, costValue: 10_000 },
  { ticker: "OGDC", sector: "Energy", marketValue: 30_000, costValue: 50_000 },
  { ticker: "HBL", sector: "Banks", marketValue: 20_000, costValue: 20_000 },
];

describe("buildAllocationSlices", () => {
  it("sums holdings into their sector", () => {
    const slices = buildAllocationSlices(holdings, "sector", "market");
    expect(slices.map((s) => s.label)).toEqual(["Cement", "Energy", "Banks"]);

    const cement = slices.find((s) => s.label === "Cement");
    expect(cement?.marketValue).toBe(50_000);
    expect(cement?.costValue).toBe(30_000);
  });

  it("leaves tickers ungrouped", () => {
    const slices = buildAllocationSlices(holdings, "ticker", "market");
    expect(slices).toHaveLength(4);
    expect(slices[0].label).toBe("LUCK");
    expect(slices[0].marketValue).toBe(40_000);
  });

  /**
   * The whole point of the widget: a position can be a bigger share of today's
   * value than of the money that bought it, or the other way round. Cement is
   * 50% of market on 30% of cost; Energy is 30% of market on 50% of cost.
   */
  it("weights each slice against its own total, not a shared one", () => {
    const slices = buildAllocationSlices(holdings, "sector", "market");
    const by = (label: string) => slices.find((s) => s.label === label)!;

    expect(by("Cement").marketWeight).toBeCloseTo(0.5, 10);
    expect(by("Cement").costWeight).toBeCloseTo(0.3, 10);
    expect(by("Energy").marketWeight).toBeCloseTo(0.3, 10);
    expect(by("Energy").costWeight).toBeCloseTo(0.5, 10);

    for (const key of ["marketWeight", "costWeight"] as const) {
      expect(slices.reduce((sum, s) => sum + s[key], 0)).toBeCloseTo(1, 10);
    }
  });

  it("orders by the active basis", () => {
    expect(buildAllocationSlices(holdings, "sector", "market").map((s) => s.label)).toEqual([
      "Cement",
      "Energy",
      "Banks",
    ]);
    expect(buildAllocationSlices(holdings, "sector", "cost").map((s) => s.label)).toEqual([
      "Energy",
      "Cement",
      "Banks",
    ]);
  });

  /** Ties would otherwise fall back to Map insertion order, so colours would
      shuffle between renders. */
  it("breaks ties by name so slice colours are stable", () => {
    const tied: AllocationInput[] = [
      { ticker: "B", sector: "Zeta", marketValue: 100, costValue: 100 },
      { ticker: "A", sector: "Alpha", marketValue: 100, costValue: 100 },
    ];
    expect(buildAllocationSlices(tied, "sector", "market").map((s) => s.label)).toEqual([
      "Alpha",
      "Zeta",
    ]);
  });

  it("names a blank sector rather than leaving it empty", () => {
    const slices = buildAllocationSlices(
      [{ ticker: "X", sector: "", marketValue: 100, costValue: 100 }],
      "sector",
      "market",
    );
    expect(slices[0].label).toBe("Uncategorized");
    expect(slices[0].key).toBe("Uncategorized");
  });

  /** A bonus issue has market value and no cost — a real case, not a bug. */
  it("keeps a zero-cost slice instead of dropping it", () => {
    const slices = buildAllocationSlices(
      [
        { ticker: "FREE", sector: "Bonus", marketValue: 100, costValue: 0 },
        { ticker: "PAID", sector: "Other", marketValue: 100, costValue: 100 },
      ],
      "ticker",
      "market",
    );
    expect(slices).toHaveLength(2);
    expect(slices.find((s) => s.label === "FREE")?.costWeight).toBe(0);
  });

  it("returns zero weights rather than NaN when a total is zero", () => {
    const slices = buildAllocationSlices(
      [{ ticker: "X", sector: "S", marketValue: 0, costValue: 0 }],
      "ticker",
      "market",
    );
    expect(slices[0].marketWeight).toBe(0);
    expect(slices[0].costWeight).toBe(0);
    expect(Number.isNaN(slices[0].marketWeight)).toBe(false);
  });

  it("handles an empty portfolio", () => {
    expect(buildAllocationSlices([], "sector", "market")).toEqual([]);
    expect(allocationTotal([], "market")).toBe(0);
  });
});

/**
 * The Allocation band shows the same numbers three ways — donut, treemap, and
 * the "Top 3 / largest" line under them. All three read this function, so they
 * share a denominator by construction. Cash is excluded upstream; what is
 * pinned here is that whatever is passed in is weighted only against itself.
 */
describe("one denominator for the whole band", () => {
  it("re-bases when cash is dropped rather than leaving a short total", () => {
    const withCash: AllocationInput[] = [
      ...holdings,
      { ticker: "CASH", sector: "Cash", marketValue: 100_000, costValue: 100_000 },
    ];

    // Half the account is cash, so every position's account-wide weight halves.
    const all = buildAllocationSlices(withCash, "ticker", "market");
    expect(all.find((s) => s.label === "LUCK")?.marketWeight).toBeCloseTo(0.2, 10);

    // Dropping it must renormalize, not leave the positions summing to 0.5.
    const positions = buildAllocationSlices(holdings, "ticker", "market");
    expect(positions.find((s) => s.label === "LUCK")?.marketWeight).toBeCloseTo(0.4, 10);
    expect(positions.reduce((sum, s) => sum + s.marketWeight, 0)).toBeCloseTo(1, 10);
  });

  it("gives the sector and ticker groupings the same total", () => {
    const bySector = buildAllocationSlices(holdings, "sector", "market");
    const byTicker = buildAllocationSlices(holdings, "ticker", "market");
    expect(allocationTotal(bySector, "market")).toBe(allocationTotal(byTicker, "market"));
    expect(allocationTotal(bySector, "cost")).toBe(allocationTotal(byTicker, "cost"));
  });

  it("makes top-3 concentration a share of invested value", () => {
    const slices = buildAllocationSlices(holdings, "ticker", "market");
    const top3 = slices.slice(0, 3).reduce((sum, s) => sum + s.marketWeight, 0);
    // 40k + 30k + 20k of a 100k invested book.
    expect(top3).toBeCloseTo(0.9, 10);
    expect(slices[0].marketWeight).toBeCloseTo(0.4, 10);
  });
});

describe("basis accessors", () => {
  it("read the side they are asked for", () => {
    const [slice] = buildAllocationSlices(
      [{ ticker: "X", sector: "S", marketValue: 300, costValue: 100 }],
      "ticker",
      "market",
    );
    expect(valueFor(slice, "market")).toBe(300);
    expect(valueFor(slice, "cost")).toBe(100);
    expect(weightFor(slice, "market")).toBe(1);
    expect(weightFor(slice, "cost")).toBe(1);
  });

  it("totals the active basis", () => {
    const slices = buildAllocationSlices(holdings, "sector", "market");
    expect(allocationTotal(slices, "market")).toBe(100_000);
    expect(allocationTotal(slices, "cost")).toBe(100_000);
  });
});
