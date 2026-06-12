import { describe, expect, it } from "vitest";
import {
  cadenceState,
  driftStatusFor,
  isRebalanceSuggestion,
} from "./rebalance";
import { REBALANCE, TARGET_DEFAULTS } from "../constants";

describe("driftStatusFor", () => {
  it("classifies on-track strictly below the warn threshold", () => {
    expect(driftStatusFor(TARGET_DEFAULTS.WARN_THRESHOLD - 0.0001)).toBe("ontrack");
    expect(driftStatusFor(0)).toBe("ontrack");
  });

  it("classifies warn at the warn boundary inclusive", () => {
    expect(driftStatusFor(TARGET_DEFAULTS.WARN_THRESHOLD)).toBe("warn");
    expect(driftStatusFor(TARGET_DEFAULTS.CRITICAL_THRESHOLD - 0.0001)).toBe("warn");
  });

  it("classifies critical at the critical boundary inclusive", () => {
    expect(driftStatusFor(TARGET_DEFAULTS.CRITICAL_THRESHOLD)).toBe("critical");
    expect(driftStatusFor(1)).toBe("critical");
  });

  it("respects per-row overrides", () => {
    expect(driftStatusFor(0.04, 0.03, 0.07)).toBe("warn");
    expect(driftStatusFor(0.08, 0.03, 0.07)).toBe("critical");
    expect(driftStatusFor(0.02, 0.03, 0.07)).toBe("ontrack");
  });
});

describe("isRebalanceSuggestion", () => {
  it("suppresses gaps below the PKR floor on small portfolios", () => {
    const total = 100_000;
    expect(isRebalanceSuggestion(REBALANCE.MIN_PKR, total)).toBe(false);
    expect(isRebalanceSuggestion(REBALANCE.MIN_PKR + 1, total)).toBe(true);
  });

  it("suppresses gaps below the fractional floor on large portfolios", () => {
    const total = 10_000_000;
    expect(isRebalanceSuggestion(50_000, total)).toBe(false);
    expect(isRebalanceSuggestion(100_001, total)).toBe(true);
  });

  it("treats negative gaps symmetrically", () => {
    expect(isRebalanceSuggestion(-7000, 100_000)).toBe(true);
    expect(isRebalanceSuggestion(-1000, 100_000)).toBe(false);
  });

  it("forces a suggestion when cadenceOverride is true and gap is non-zero", () => {
    expect(isRebalanceSuggestion(100, 100_000, true)).toBe(true);
    expect(isRebalanceSuggestion(0, 100_000, true)).toBe(false);
  });
});

describe("cadenceState", () => {
  const now = new Date("2026-06-12T00:00:00Z");

  it("returns 'never' when lastRebalancedAt is missing or invalid", () => {
    expect(cadenceState(null, "monthly", now).state).toBe("never");
    expect(cadenceState(undefined, "monthly", now).state).toBe("never");
    expect(cadenceState("not-a-date", "monthly", now).state).toBe("never");
  });

  it("returns 'fresh' soon after a rebalance", () => {
    const lastIso = new Date("2026-06-10T00:00:00Z").toISOString();
    const { state, daysUntilDue } = cadenceState(lastIso, "monthly", now);
    expect(state).toBe("fresh");
    expect(daysUntilDue).toBeGreaterThan(7);
  });

  it("returns 'soon' when due in the next week", () => {
    const lastIso = new Date("2026-05-18T00:00:00Z").toISOString();
    expect(cadenceState(lastIso, "monthly", now).state).toBe("soon");
  });

  it("returns 'due' near the cadence boundary", () => {
    const lastIso = new Date("2026-05-13T00:00:00Z").toISOString();
    expect(cadenceState(lastIso, "monthly", now).state).toBe("due");
  });

  it("returns 'overdue' well past the cadence boundary", () => {
    const lastIso = new Date("2026-04-01T00:00:00Z").toISOString();
    expect(cadenceState(lastIso, "monthly", now).state).toBe("overdue");
  });

  it("scales with cadence (weekly is shorter window)", () => {
    const lastIso = new Date("2026-06-02T00:00:00Z").toISOString();
    expect(cadenceState(lastIso, "weekly", now).state).toBe("overdue");
    expect(cadenceState(lastIso, "yearly", now).state).toBe("fresh");
  });
});
