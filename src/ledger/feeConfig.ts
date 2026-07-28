// Broker fee + tax rate configuration. One editable current rate set (no rate
// history) — every field is surfaced on the Settings form.
//
// ⚠️ The defaults below are best-effort starting points, NOT authoritative.
// The commission slab comes from the PSX prescribed slab; the CDC/NCCPL/SECP
// charges vary by broker and the tax percentages move with each Finance Act.
// Check them against a real broker note and edit in Settings.

/** Percent rates are plain numbers (15 = 15%). Money fields are paisa. */
export type FeeConfig = {
  /** Trade price at/below which commission is charged per share. Paisa. */
  commissionCutoff: number;
  /** Commission per share for prices at/below the cutoff. Paisa. */
  commissionPerShare: number;
  /** Commission as a percent of trade value, above the cutoff. */
  commissionPct: number;
  /** Broker minimum commission per trade. Paisa. 0 disables the floor. */
  commissionMin: number;
  /** Sales tax / FED charged on the commission, percent. */
  salesTaxOnCommissionPct: number;
  /** CDC transaction charge, percent of trade value. */
  cdcPct: number;
  /** NCCPL clearing + CGT determination charge, percent of trade value. */
  nccplPct: number;
  /** SECP / PSX levy, percent of trade value. */
  secpPct: number;
  /** Flat charge applied once per trade regardless of size. Paisa. */
  flatFeePerTrade: number;
  /** CGT on gains from shares acquired on/after `cgtLegacyCutoff`, percent. */
  cgtRatePct: number;
  /** CGT on gains from shares acquired before `cgtLegacyCutoff`, percent. */
  cgtLegacyRatePct: number;
  /** ISO date separating the two CGT tiers. */
  cgtLegacyCutoff: string;
  /** Withholding tax on cash dividends, percent. */
  dividendWhtPct: number;
  /** Tax on the issue value of bonus shares, percent. */
  bonusTaxPct: number;
};

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  // PSX prescribed slab: ≤ Rs 20.00 → Rs 0.03/share, > Rs 20.00 → 0.15% of value.
  commissionCutoff: 2000,
  commissionPerShare: 3,
  commissionPct: 0.15,
  commissionMin: 0,
  // Sindh sales tax on brokerage services. Derived from a real IWT broker note
  // (13% fits the settled Taxes/Charges column to the paisa across 12 trades).
  salesTaxOnCommissionPct: 13,
  cdcPct: 0.005,
  nccplPct: 0.005,
  secpPct: 0.0015,
  // Flat per-trade CDC/settlement charge. The broker note shows a fixed ~Rs 5.00
  // on every trade, independent of size — the piece a pure percentage misses.
  flatFeePerTrade: 500,
  // Finance Act 2024: 15% for shares acquired on/after 1 Jul 2024, 12.5% for
  // the 1 Jul 2022 – 30 Jun 2024 tranche.
  cgtRatePct: 15,
  cgtLegacyRatePct: 12.5,
  cgtLegacyCutoff: "2024-07-01",
  dividendWhtPct: 15,
  bonusTaxPct: 10,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

function nonNegative(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function percent(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return fallback;
  return n;
}

/**
 * Coerce a partial / user-edited / round-tripped config into a complete, sane
 * one. Bad values fall back to the default field-by-field rather than rejecting
 * the whole object, so one typo can never wipe a saved configuration.
 */
export function normalizeFeeConfig(raw: unknown): FeeConfig {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<FeeConfig>;
  const d = DEFAULT_FEE_CONFIG;

  const cutoff = String(c.cgtLegacyCutoff ?? "");

  return {
    commissionCutoff: Math.round(nonNegative(c.commissionCutoff, d.commissionCutoff)),
    commissionPerShare: nonNegative(c.commissionPerShare, d.commissionPerShare),
    commissionPct: percent(c.commissionPct, d.commissionPct),
    commissionMin: Math.round(nonNegative(c.commissionMin, d.commissionMin)),
    salesTaxOnCommissionPct: percent(
      c.salesTaxOnCommissionPct,
      d.salesTaxOnCommissionPct,
    ),
    cdcPct: percent(c.cdcPct, d.cdcPct),
    nccplPct: percent(c.nccplPct, d.nccplPct),
    secpPct: percent(c.secpPct, d.secpPct),
    flatFeePerTrade: Math.round(nonNegative(c.flatFeePerTrade, d.flatFeePerTrade)),
    cgtRatePct: percent(c.cgtRatePct, d.cgtRatePct),
    cgtLegacyRatePct: percent(c.cgtLegacyRatePct, d.cgtLegacyRatePct),
    cgtLegacyCutoff: ISO_DATE.test(cutoff) ? cutoff.slice(0, 10) : d.cgtLegacyCutoff,
    dividendWhtPct: percent(c.dividendWhtPct, d.dividendWhtPct),
    bonusTaxPct: percent(c.bonusTaxPct, d.bonusTaxPct),
  };
}
