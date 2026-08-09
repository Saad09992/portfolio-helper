import { describe, expect, it } from "vitest";
import {
  ADVANCED_ONLY_BANDS,
  DEFAULT_VIEW_MODE,
  OVERVIEW_BANDS,
  bandNumbers,
  isBandVisible,
  isViewMode,
  visibleBands,
} from "./overviewBands";

describe("overview bands", () => {
  it("shows every band in Advanced, numbered 01 through 07", () => {
    expect(visibleBands("advanced")).toEqual([...OVERVIEW_BANDS]);

    const numbers = bandNumbers("advanced");
    expect(OVERVIEW_BANDS.map((id) => numbers[id])).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
    ]);
  });

  it("shows the four everyday bands in Basic", () => {
    expect(visibleBands("basic")).toEqual([
      "position",
      "history",
      "today",
      "allocation",
    ]);
  });

  /**
   * The gaps are the whole reason this is computed rather than hardcoded: three
   * hidden bands would otherwise leave 01, 03, 04, 05 on screen, which reads as
   * breakage.
   */
  it("renumbers Basic contiguously instead of leaving gaps", () => {
    const numbers = bandNumbers("basic");
    expect(visibleBands("basic").map((id) => numbers[id])).toEqual([
      "01",
      "02",
      "03",
      "04",
    ]);
  });

  it("gives hidden bands no number at all", () => {
    const numbers = bandNumbers("basic");
    for (const id of ADVANCED_ONLY_BANDS) {
      expect(numbers[id]).toBe("");
      expect(isBandVisible(id, "basic")).toBe(false);
      expect(isBandVisible(id, "advanced")).toBe(true);
    }
  });

  /** A typo'd id here would silently hide nothing, so pin it. */
  it("only lists real bands as advanced-only", () => {
    for (const id of ADVANCED_ONLY_BANDS) {
      expect(OVERVIEW_BANDS).toContain(id);
    }
    expect(ADVANCED_ONLY_BANDS.length).toBeLessThan(OVERVIEW_BANDS.length);
  });

  it("defaults to Basic and rejects anything that is not a mode", () => {
    expect(DEFAULT_VIEW_MODE).toBe("basic");
    expect(isViewMode("basic")).toBe(true);
    expect(isViewMode("advanced")).toBe(true);
    for (const junk of ["ADVANCED", "", "expert", null, undefined, 1, {}]) {
      expect(isViewMode(junk)).toBe(false);
    }
  });
});
