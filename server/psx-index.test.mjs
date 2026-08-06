import { describe, it, expect } from "vitest";
import { parseEodTimeseries, parsePsxIndexPage } from "./psx-index.mjs";

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

describe("parsePsxIndexPage", () => {
  // Trimmed from the live www.psx.com.pk home page. The `id="cahnge"` typo and
  // the duplicated `id="volume"` are upstream's, reproduced verbatim — the
  // parser must not be "corrected" to ids that don't exist.
  const html = `
    <table><tbody>
      <tr><td>Market Status</td><td>Open </td></tr>
      <tr><td>Current Index</td><td id="curIndex">180,756.91</td></tr>
      <tr><td>Change</td><td id="cahnge">741.98</td></tr>
      <tr><td>Percent Change</td><td id="percentchange">0.41%</td></tr>
      <tr><td>High</td><td id="high">181,687.19</td></tr>
      <tr><td>Low</td><td id="low">180,686.36</td></tr>
      <tr><td>Volume</td><td id="volume">142,142,177</td></tr>
      <tr><td>Previous Close</td><td id="volume">180,014.93</td></tr>
    </tbody></table>`;

  it("extracts the current level with thousands separators stripped", () => {
    const out = parsePsxIndexPage(html);
    expect(out.current).toBe(180756.91);
    expect(out.changePct).toBeCloseTo(0.41, 6);
    expect(out.source).toBe("psx-www");
  });

  it("carries no series — the home page has no history", () => {
    expect(parsePsxIndexPage(html).series).toEqual([]);
  });

  it("stamps asOf with fetch time so freshness has something to compare", () => {
    const before = Date.now();
    const out = parsePsxIndexPage(html);
    expect(Date.parse(out.asOf)).toBeGreaterThanOrEqual(before);
  });

  it("takes the percent sign from the change cell on a down day", () => {
    const down = html
      .replace('id="cahnge">741.98', 'id="cahnge">-741.98')
      .replace('id="percentchange">0.41%', 'id="percentchange">0.41%');
    expect(parsePsxIndexPage(down).changePct).toBeCloseTo(-0.41, 6);
  });

  it("returns null when the index cell is missing or unusable", () => {
    expect(parsePsxIndexPage("")).toBeNull();
    expect(parsePsxIndexPage(null)).toBeNull();
    expect(parsePsxIndexPage("<table><tr><td>no index here</td></tr></table>")).toBeNull();
    expect(parsePsxIndexPage('<td id="curIndex">0</td>')).toBeNull();
  });
});
