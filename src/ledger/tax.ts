// Fiscal-year tax view: capital gains netting, loss carry-forward, dividend
// withholding and bonus tax.
//
// Pakistan's tax year runs 1 July – 30 June and is named for the year it ends
// in ("2025-26" = 1 Jul 2025 → 30 Jun 2026). Capital losses on securities may
// be carried forward against future capital gains for three tax years.
//
// What NCCPL actually deducts trade-by-trade (`cgtCharged`) is compared with
// what the year's netted position implies (`cgtDue`) — the difference is the
// refund or shortfall to expect at settlement.

import { roundPaisa } from "../money";
import type { FeeConfig } from "./feeConfig";
import { dayOf } from "./replay";
import type {
  BonusTaxCharge,
  DividendReceipt,
  LedgerState,
  RealizedSlice,
} from "./types";

/** Tax years a loss stays available for after the year it arose. */
export const LOSS_CARRY_FORWARD_YEARS = 3;

export type TaxYear = {
  /** e.g. "2025-26" */
  fy: string;
  startDate: string;
  endDate: string;
  /** paisa — sum of positive realized gains */
  gains: number;
  /** paisa — sum of realized losses, as a positive number */
  losses: number;
  /** paisa — losses brought forward and available this year */
  carryIn: number;
  /** paisa — losses (current + brought forward) actually set off */
  offsetUsed: number;
  /** paisa — gains left after set-off */
  taxable: number;
  /** effective rate applied, blended across the year's CGT tiers */
  effectiveRatePct: number;
  /** paisa — CGT implied by the netted position */
  cgtDue: number;
  /** paisa — CGT already deducted trade-by-trade */
  cgtCharged: number;
  /** paisa — positive means over-deducted (refund), negative means shortfall */
  cgtRefundable: number;
  /** paisa — unused losses carried into later years */
  carryOut: number;
  dividendGross: number;
  dividendWht: number;
  bonusTax: number;
  /** paisa — brokerage costs on the year's sales */
  sellFees: number;
  sales: RealizedSlice[];
  dividends: DividendReceipt[];
  bonuses: BonusTaxCharge[];
};

/** Fiscal year label for an ISO date. July starts a new year. */
export function fiscalYearOf(iso: string): string {
  const day = dayOf(iso);
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return "";
  const start = month >= 7 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function fiscalYearRange(fy: string): { startDate: string; endDate: string } {
  const start = Number(fy.slice(0, 4));
  return { startDate: `${start}-07-01`, endDate: `${start + 1}-06-30` };
}

/** Numeric key so carry-forward expiry can be measured in years. */
function fyIndex(fy: string): number {
  return Number(fy.slice(0, 4));
}

type CarryBucket = { fy: string; amount: number };

function emptyYear(fy: string): TaxYear {
  return {
    fy,
    ...fiscalYearRange(fy),
    gains: 0,
    losses: 0,
    carryIn: 0,
    offsetUsed: 0,
    taxable: 0,
    effectiveRatePct: 0,
    cgtDue: 0,
    cgtCharged: 0,
    cgtRefundable: 0,
    carryOut: 0,
    dividendGross: 0,
    dividendWht: 0,
    bonusTax: 0,
    sellFees: 0,
    sales: [],
    dividends: [],
    bonuses: [],
  };
}

/**
 * Fiscal-year breakdown, oldest first. Years with no activity between two
 * active years are included as empty rows so carry-forward ageing is visible.
 */
export function buildTaxYears(state: LedgerState, cfg: FeeConfig): TaxYear[] {
  const years = new Map<string, TaxYear>();

  const yearFor = (iso: string): TaxYear | null => {
    const fy = fiscalYearOf(iso);
    if (!fy) return null;
    let year = years.get(fy);
    if (!year) {
      year = emptyYear(fy);
      years.set(fy, year);
    }
    return year;
  };

  for (const sale of state.realized) {
    const year = yearFor(sale.sellDate);
    if (!year) continue;
    year.sales.push(sale);
    year.sellFees += sale.fees;
    year.cgtCharged += sale.cgt;
    if (sale.gain > 0) year.gains += sale.gain;
    else year.losses += -sale.gain;
  }

  for (const receipt of state.dividends) {
    const year = yearFor(receipt.date);
    if (!year) continue;
    year.dividends.push(receipt);
    year.dividendGross += receipt.gross;
    year.dividendWht += receipt.wht;
  }

  for (const bonus of state.bonusTaxes) {
    const year = yearFor(bonus.date);
    if (!year) continue;
    year.bonuses.push(bonus);
    year.bonusTax += bonus.tax;
  }

  const ordered = fillGaps([...years.values()].sort((a, b) => a.fy.localeCompare(b.fy)));

  // Walk forward applying losses: this year's first, then the oldest brought
  // forward, dropping buckets once they age out.
  let buckets: CarryBucket[] = [];
  for (const year of ordered) {
    buckets = buckets.filter(
      (b) => fyIndex(year.fy) - fyIndex(b.fy) <= LOSS_CARRY_FORWARD_YEARS,
    );
    year.carryIn = buckets.reduce((sum, b) => sum + b.amount, 0);

    const available = year.losses + year.carryIn;
    const offset = Math.min(available, year.gains);
    year.offsetUsed = offset;
    year.taxable = year.gains - offset;

    // Consume current-year losses first, then the oldest buckets.
    let toConsume = offset;
    const currentUsed = Math.min(year.losses, toConsume);
    toConsume -= currentUsed;
    for (const bucket of buckets) {
      if (toConsume <= 0) break;
      const take = Math.min(bucket.amount, toConsume);
      bucket.amount -= take;
      toConsume -= take;
    }
    buckets = buckets.filter((b) => b.amount > 0);

    const unusedCurrent = year.losses - currentUsed;
    if (unusedCurrent > 0) buckets.push({ fy: year.fy, amount: unusedCurrent });

    year.carryOut = buckets.reduce((sum, b) => sum + b.amount, 0);

    // Blend the tiers actually used this year rather than assuming one rate.
    year.effectiveRatePct =
      year.gains > 0 ? (year.cgtCharged / year.gains) * 100 : cfg.cgtRatePct;
    year.cgtDue = roundPaisa((year.taxable * year.effectiveRatePct) / 100);
    year.cgtRefundable = year.cgtCharged - year.cgtDue;
  }

  return ordered;
}

/** Insert empty rows for fiscal years between the first and last active one. */
function fillGaps(years: TaxYear[]): TaxYear[] {
  if (years.length < 2) return years;
  const out: TaxYear[] = [];
  const first = fyIndex(years[0].fy);
  const last = fyIndex(years[years.length - 1].fy);
  const byIndex = new Map(years.map((y) => [fyIndex(y.fy), y]));

  for (let i = first; i <= last; i++) {
    const existing = byIndex.get(i);
    out.push(existing ?? emptyYear(`${i}-${String((i + 1) % 100).padStart(2, "0")}`));
  }
  return out;
}
