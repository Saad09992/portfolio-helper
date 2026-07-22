import { describe, expect, it } from "vitest";
import { ImportParseError, parseImportBundle } from "./importExport";

describe("parseImportBundle", () => {
  it("parses a full valid bundle", () => {
    const result = parseImportBundle({
      version: 2,
      holdings: [{ id: "1", ticker: "OGDC" }],
      cash: { available: 1000 },
      targets: [{ id: "t1", mode: "sector", key: "Energy", targetWeight: 0.2 }],
      investments: [{ id: "i1", date: "2026-01-01", amount: 1000, valueEom: 1100 }],
      history: [{ date: "2026-01-01", totalValue: 1000, totalCost: 1000, gainLoss: 0 }],
      lastFetchedAt: "2026-05-14T10:00:00Z",
      exportedAt: "2026-05-14T11:00:00Z",
    });
    expect(result.holdings).toHaveLength(1);
    expect(result.cash?.available).toBe(1000);
    expect(result.targets).toHaveLength(1);
    expect(result.investments).toHaveLength(1);
    expect(result.history).toHaveLength(1);
    expect(result.lastFetchedAt).toBe("2026-05-14T10:00:00Z");
    expect(result.exportedAt).toBe("2026-05-14T11:00:00Z");
  });

  it("upconverts legacy rupee files (no version) to integer paisa", () => {
    const result = parseImportBundle({
      holdings: [
        {
          id: "1",
          ticker: "KEL",
          price: 4.92,
          costBasis: 4.28,
          dividendPerShare: 0.35,
          payouts: [{ announcementDate: "", bookClosureDate: "", dividendPerShare: 0.35 }],
        },
      ],
      cash: { available: 90.92 },
      investments: [{ id: "i1", date: "2026-01-01", amount: 1000, valueEom: 1100 }],
      history: [{ date: "2026-01-01", totalValue: 24600, totalCost: 21400, gainLoss: 3200 }],
    });
    expect(result.holdings?.[0].price).toBe(492);
    expect(result.holdings?.[0].costBasis).toBe(428);
    expect(result.holdings?.[0].dividendPerShare).toBe(35);
    expect(result.holdings?.[0].payouts?.[0].dividendPerShare).toBe(35);
    expect(result.cash?.available).toBe(9092);
    expect(result.investments?.[0].amount).toBe(100000);
    expect(result.investments?.[0].valueEom).toBe(110000);
    expect(result.history?.[0].totalValue).toBe(2460000);
  });

  it("passes v2 (paisa) files through unchanged", () => {
    const result = parseImportBundle({
      version: 2,
      holdings: [{ id: "1", ticker: "KEL", price: 492, costBasis: 428 }],
      cash: { available: 9092 },
    });
    expect(result.holdings?.[0].price).toBe(492);
    expect(result.cash?.available).toBe(9092);
  });

  it("nulls out fields with wrong types instead of throwing", () => {
    const result = parseImportBundle({
      holdings: "not-an-array",
      cash: [1, 2, 3],
      targets: { not: "array" },
      lastFetchedAt: 12345,
      // at least one valid field so the bundle is not rejected
      investments: [],
    });
    expect(result.holdings).toBeNull();
    expect(result.cash).toBeNull();
    expect(result.targets).toBeNull();
    expect(result.lastFetchedAt).toBeNull();
    expect(result.investments).toEqual([]);
  });

  it("ignores unknown keys silently", () => {
    const result = parseImportBundle({
      holdings: [],
      schema: "psx-portfolio-tools",
      version: 1,
      randomExtra: { foo: "bar" },
    });
    expect(result.holdings).toEqual([]);
  });

  it("throws ImportParseError on non-object input", () => {
    expect(() => parseImportBundle(null)).toThrow(ImportParseError);
    expect(() => parseImportBundle("string")).toThrow(ImportParseError);
    expect(() => parseImportBundle([1, 2, 3])).toThrow(ImportParseError);
    expect(() => parseImportBundle(42)).toThrow(ImportParseError);
  });

  it("throws ImportParseError when no recognized fields are present", () => {
    expect(() => parseImportBundle({})).toThrow(ImportParseError);
    expect(() => parseImportBundle({ schema: "x", version: 1 })).toThrow(ImportParseError);
  });
});
