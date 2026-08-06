import { describe, expect, it } from "vitest";
import {
  allocateProRata,
  applyOverride,
  computeCommission,
  computeTradeCosts,
  tradeValue,
} from "./fees";
import { DEFAULT_FEE_CONFIG, normalizeFeeConfig } from "./feeConfig";
import { ZERO_FEES } from "./types";

const cfg = DEFAULT_FEE_CONFIG;

describe("commission slab", () => {
  it("charges per share at the Rs 20.00 boundary", () => {
    // 1000 shares @ Rs 20.00 → 1000 × Rs 0.03 = Rs 30.00 = 3000 paisa
    expect(computeCommission(1000, 2000, cfg)).toBe(3000);
  });

  it("switches to percent-of-value one paisa above the cutoff", () => {
    // 1000 shares @ Rs 20.01 → value 2,001,000 paisa, 0.15% = 3001.5 → 3002
    expect(computeCommission(1000, 2001, cfg)).toBe(3002);
  });

  it("charges percent of value well above the cutoff", () => {
    // 100 shares @ Rs 145.00 → value 1,450,000 paisa, 0.15% = Rs 21.75
    expect(computeCommission(100, 14500, cfg)).toBe(2175);
  });

  it("applies the broker minimum when configured", () => {
    const withMin = { ...cfg, commissionMin: 10000 }; // Rs 100 floor
    expect(computeCommission(10, 14500, withMin)).toBe(10000);
  });
});

describe("computeTradeCosts", () => {
  it("itemizes a buy and totals exactly the sum of components", () => {
    const fees = computeTradeCosts(100, 14500, cfg);
    const value = tradeValue(100, 14500);

    expect(value).toBe(1_450_000);
    expect(fees.commission).toBe(2175);
    expect(fees.salesTax).toBe(326); // 15% of 2175 = 326.25 → 326
    expect(fees.cdc).toBe(0); // billed flat, not as a percentage
    expect(fees.nccpl).toBe(46); // 0.0032% of 1,450,000 = 46.4 → 46
    expect(fees.secp).toBe(71); // 0.0049% = 71.05 → 71
    expect(fees.flatFee).toBe(500); // flat Rs 5.00 per trade
    expect(fees.total).toBe(
      fees.commission +
        fees.salesTax +
        fees.cdc +
        fees.nccpl +
        fees.secp +
        fees.flatFee,
    );
  });

  it("returns whole paisa for every component", () => {
    const fees = computeTradeCosts(377, 4931, cfg);
    for (const v of Object.values(fees)) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("lets an override replace one component and re-totals", () => {
    const fees = computeTradeCosts(100, 14500, cfg, { commission: 5000 });
    expect(fees.commission).toBe(5000);
    expect(fees.salesTax).toBe(326); // untouched — only the named component moves
    expect(fees.total).toBe(5000 + 326 + 0 + 46 + 71 + 500);
  });

  it("honours an explicit total override", () => {
    const fees = computeTradeCosts(100, 14500, cfg, { total: 9999 });
    expect(fees.total).toBe(9999);
  });

  it("treats zero shares as a free trade", () => {
    const fees = computeTradeCosts(0, 14500, cfg);
    expect(fees.total).toBe(0);
  });
});

describe("applyOverride", () => {
  it("totals a zero base from overrides alone", () => {
    const fees = applyOverride(ZERO_FEES, { commission: 1200, salesTax: 180 });
    expect(fees.total).toBe(1380);
  });
});

describe("allocateProRata", () => {
  it("splits a total across weights without losing paisa", () => {
    const parts = allocateProRata(1000, [1, 1, 1]);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(1000);
  });

  it("conserves the total on an awkward split", () => {
    const parts = allocateProRata(3001, [7, 13, 31]);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(3001);
  });

  it("returns zeros when all weights are zero", () => {
    expect(allocateProRata(500, [0, 0])).toEqual([0, 0]);
  });
});

describe("normalizeFeeConfig", () => {
  it("fills an empty object with defaults", () => {
    expect(normalizeFeeConfig({})).toEqual(DEFAULT_FEE_CONFIG);
  });

  it("falls back per field instead of rejecting the whole config", () => {
    const out = normalizeFeeConfig({ commissionPct: -3, cgtRatePct: 20 });
    expect(out.commissionPct).toBe(DEFAULT_FEE_CONFIG.commissionPct);
    expect(out.cgtRatePct).toBe(20);
  });

  it("rejects a malformed CGT cutoff date", () => {
    expect(normalizeFeeConfig({ cgtLegacyCutoff: "nonsense" }).cgtLegacyCutoff).toBe(
      DEFAULT_FEE_CONFIG.cgtLegacyCutoff,
    );
  });

  it("keeps a valid cutoff date, trimmed to a day", () => {
    expect(
      normalizeFeeConfig({ cgtLegacyCutoff: "2022-07-01T00:00:00Z" }).cgtLegacyCutoff,
    ).toBe("2022-07-01");
  });

  it("keeps well-formed opening losses, sorted by fiscal year", () => {
    const out = normalizeFeeConfig({
      openingLosses: [
        { fy: "2025-26", amount: 461_858 },
        { fy: "2023-24", amount: 1000 },
      ],
    });
    expect(out.openingLosses).toEqual([
      { fy: "2023-24", amount: 1000 },
      { fy: "2025-26", amount: 461_858 },
    ]);
  });

  it("drops half-typed and non-positive opening losses", () => {
    const out = normalizeFeeConfig({
      openingLosses: [
        { fy: "2025-2", amount: 5000 }, // still being typed
        { fy: "2025-26", amount: 0 }, // no loss to carry
        { fy: "2025-26", amount: -100 }, // losses are stored positive
        null,
      ],
    });
    expect(out.openingLosses).toEqual([]);
  });

  it("collapses duplicate fiscal years into one bucket", () => {
    const out = normalizeFeeConfig({
      openingLosses: [
        { fy: "2024-25", amount: 1000 },
        { fy: "2024-25", amount: 250 },
      ],
    });
    expect(out.openingLosses).toEqual([{ fy: "2024-25", amount: 1250 }]);
  });

  it("ignores a non-array openingLosses", () => {
    expect(normalizeFeeConfig({ openingLosses: "nope" }).openingLosses).toEqual([]);
  });
});
