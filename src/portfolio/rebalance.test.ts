import { describe, expect, it } from "vitest";
import { driftStatus, isRebalanceSuggestion } from "./rebalance";
import { DRIFT, REBALANCE } from "../constants";

describe("driftStatus", () => {
  it("classifies on-track strictly below MODERATE", () => {
    expect(driftStatus(DRIFT.MODERATE - 0.0001)).toBe("ontrack");
    expect(driftStatus(0)).toBe("ontrack");
  });

  it("classifies moderate at the MODERATE boundary inclusive", () => {
    expect(driftStatus(DRIFT.MODERATE)).toBe("moderate");
    expect(driftStatus(DRIFT.SEVERE - 0.0001)).toBe("moderate");
  });

  it("classifies severe at the SEVERE boundary inclusive", () => {
    expect(driftStatus(DRIFT.SEVERE)).toBe("severe");
    expect(driftStatus(1)).toBe("severe");
  });
});

describe("isRebalanceSuggestion", () => {
  it("suppresses gaps below the PKR floor on small portfolios", () => {
    const total = 100_000; // 1% = 1000, so PKR floor (5000) dominates
    expect(isRebalanceSuggestion(REBALANCE.MIN_PKR, total)).toBe(false);
    expect(isRebalanceSuggestion(REBALANCE.MIN_PKR + 1, total)).toBe(true);
  });

  it("suppresses gaps below the fractional floor on large portfolios", () => {
    const total = 10_000_000; // 1% = 100k, dominates PKR floor (5k)
    expect(isRebalanceSuggestion(50_000, total)).toBe(false);
    expect(isRebalanceSuggestion(100_001, total)).toBe(true);
  });

  it("treats negative gaps (sell suggestions) symmetrically", () => {
    expect(isRebalanceSuggestion(-7000, 100_000)).toBe(true);
    expect(isRebalanceSuggestion(-1000, 100_000)).toBe(false);
  });
});
