import { describe, it, expect } from "vitest";
import { parseEodTimeseries } from "./psx-index.mjs";

describe("parseEodTimeseries", () => {
  const json = {
    status: 1,
    message: "",
    // newest-first, like the live endpoint
    data: [
      [1782298800, 179571.26, 436674676, 178115.36],
      [1782212400, 177692.92, 292031741, 179307.68],
      [1782126000, 178471.86, 230108378, 180146.06],
    ],
  };

  it("returns current = latest close and ascending series", () => {
    const out = parseEodTimeseries(json);
    expect(out.current).toBe(179571.26);
    expect(out.series).toHaveLength(3);
    // ascending by date
    expect(out.series[0].close).toBe(178471.86);
    expect(out.series[2].close).toBe(179571.26);
    // change vs prior close: (179571.26-177692.92)/177692.92*100
    expect(out.changePct).toBeCloseTo(((179571.26 - 177692.92) / 177692.92) * 100, 6);
  });

  it("converts unix seconds to PKT date strings", () => {
    const out = parseEodTimeseries(json);
    expect(out.series[2].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns null on bad/empty payloads", () => {
    expect(parseEodTimeseries(null)).toBeNull();
    expect(parseEodTimeseries({ status: 0, data: [] })).toBeNull();
    expect(parseEodTimeseries({ status: 1, data: [] })).toBeNull();
  });
});
