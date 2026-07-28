// Trade cost engine. Pure paisa arithmetic: every component is rounded to whole
// paisa on its own, then summed — the same order a broker note itemizes them,
// so `total` always equals the printed components.

import { roundPaisa } from "../money";
import type { FeeConfig } from "./feeConfig";
import type { FeeBreakdown } from "./types";
import { ZERO_FEES } from "./types";

/** Gross trade value in paisa. `price` is paisa per share. */
export function tradeValue(shares: number, price: number): number {
  const s = Number.isFinite(shares) ? shares : 0;
  const p = Number.isFinite(price) ? price : 0;
  return roundPaisa(s * p);
}

/**
 * Brokerage commission for one trade, per the PSX prescribed slab: a flat
 * per-share rate at or below `commissionCutoff`, a percent of value above it.
 * A broker minimum, when configured, is applied last.
 */
export function computeCommission(
  shares: number,
  price: number,
  cfg: FeeConfig,
): number {
  const raw =
    price <= cfg.commissionCutoff
      ? roundPaisa(shares * cfg.commissionPerShare)
      : roundPaisa((tradeValue(shares, price) * cfg.commissionPct) / 100);
  return Math.max(raw, cfg.commissionMin);
}

/**
 * Full itemized cost of a BUY or SELL. Identical on both sides — PSX charges
 * the same components either way; the caller decides whether to add them to the
 * cost basis (buy) or subtract them from proceeds (sell).
 *
 * `override` replaces individual components (a figure copied off a broker note
 * always wins). When `override.total` is absent, `total` is recomputed from the
 * merged components, so overriding just the commission stays consistent.
 */
export function computeTradeCosts(
  shares: number,
  price: number,
  cfg: FeeConfig,
  override?: Partial<FeeBreakdown>,
): FeeBreakdown {
  const value = tradeValue(shares, price);

  const commission = computeCommission(shares, price, cfg);
  const computed: FeeBreakdown = {
    commission,
    salesTax: roundPaisa((commission * cfg.salesTaxOnCommissionPct) / 100),
    cdc: roundPaisa((value * cfg.cdcPct) / 100),
    nccpl: roundPaisa((value * cfg.nccplPct) / 100),
    secp: roundPaisa((value * cfg.secpPct) / 100),
    // A fixed charge, but only on an actual trade — a zero-value entry is free.
    flatFee: value > 0 ? cfg.flatFeePerTrade : 0,
    total: 0,
  };

  return applyOverride(computed, override);
}

/** Merge component overrides and re-total. Exported for RIGHT/manual entries. */
export function applyOverride(
  base: FeeBreakdown,
  override?: Partial<FeeBreakdown>,
): FeeBreakdown {
  const merged: FeeBreakdown = {
    commission: pick(override?.commission, base.commission),
    salesTax: pick(override?.salesTax, base.salesTax),
    cdc: pick(override?.cdc, base.cdc),
    nccpl: pick(override?.nccpl, base.nccpl),
    secp: pick(override?.secp, base.secp),
    flatFee: pick(override?.flatFee, base.flatFee),
    total: 0,
  };
  merged.total = pick(
    override?.total,
    merged.commission +
      merged.salesTax +
      merged.cdc +
      merged.nccpl +
      merged.secp +
      merged.flatFee,
  );
  return merged;
}

/** Zero-fee breakdown with any explicit overrides applied. */
export function manualCosts(override?: Partial<FeeBreakdown>): FeeBreakdown {
  return applyOverride(ZERO_FEES, override);
}

function pick(override: number | undefined, fallback: number): number {
  return override != null && Number.isFinite(override)
    ? roundPaisa(override)
    : fallback;
}

/**
 * Split a whole-trade fee total across matched share slices without losing or
 * inventing paisa: each slice takes its proportional share rounded down-ish via
 * `roundPaisa`, and the final slice absorbs the remainder.
 */
export function allocateProRata(
  total: number,
  weights: number[],
): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return weights.map(() => 0);

  const out: number[] = [];
  let assigned = 0;
  for (let i = 0; i < weights.length; i++) {
    if (i === weights.length - 1) {
      out.push(total - assigned);
      break;
    }
    const part = roundPaisa((total * weights[i]) / sum);
    assigned += part;
    out.push(part);
  }
  return out;
}
