// MONEY CONVENTION: every monetary field below is INTEGER PAISA (100 = ₨1),
// never rupee-floats. See src/money.ts. Share counts, ratios and percent rates
// are not money and stay plain numbers.

/**
 * Ledger event kinds.
 *
 * - BUY / SELL    — market trades; carry fees. A SELL accrues CGT but does NOT
 *                   pay it: NCCPL collects centrally, later. See TAX.
 * - DIVIDENDplain — cash dividend, taxed at `dividendWhtPct`.
 * - BONUS         — free shares; taxed at `bonusTaxPct` on their issue value.
 * - RIGHT         — rights subscription; new shares at the subscription price.
 * - SPLIT         — share split / consolidation; rescales open lots.
 * - DEPOSIT /
 *   WITHDRAW      — cash movements in and out of the brokerage account.
 * - TAX           — a CGT settlement actually debited by NCCPL. Reduces cash and
 *                   draws down the accrued reserve for its fiscal year.
 * - EXPENSE       — an account charge: SMS fees, custody, annual maintenance,
 *                   or brokerage a statement never itemised. Spends cash and
 *                   counts against P&L, but is NOT a withdrawal of capital —
 *                   booking one as WITHDRAW would shrink the contribution base
 *                   and flatter the return.
 */
export type TxnType =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "BONUS"
  | "RIGHT"
  | "SPLIT"
  | "DEPOSIT"
  | "WITHDRAW"
  | "TAX"
  | "EXPENSE";

/** Itemized trade costs, all paisa. `total` is the sum of the components. */
export type FeeBreakdown = {
  /** Brokerage commission (PSX slab). */
  commission: number;
  /** Sales tax / FED charged on the commission. */
  salesTax: number;
  /** CDC (Central Depository) transaction charge. */
  cdc: number;
  /** NCCPL clearing + CGT-determination charge. */
  nccpl: number;
  /** SECP / PSX levy ("laga"). */
  secp: number;
  /** Flat per-trade charge (CDC settlement fee etc.) — fixed, not value-based. */
  flatFee: number;
  total: number;
};

export const ZERO_FEES: FeeBreakdown = {
  commission: 0,
  salesTax: 0,
  cdc: 0,
  nccpl: 0,
  secp: 0,
  flatFee: 0,
  total: 0,
};

/**
 * A single ledger entry. Which fields matter depends on `type`:
 *
 * | type              | shares | price          | amount        |
 * |-------------------|--------|----------------|---------------|
 * | BUY/SELL/RIGHT    | yes    | paisa/share    | —             |
 * | BONUS             | yes    | issue value/sh | —             |
 * | DIVIDEND          | —      | paisa/share    | gross override|
 * | SPLIT             | —      | —              | —             |
 * | DEPOSIT/WITHDRAW  | —      | —              | paisa         |
 * | TAX / EXPENSE     | —      | —              | paisa         |
 */
export type Transaction = {
  id: string;
  /** ISO date (YYYY-MM-DD or full ISO). Drives FIFO order and the CGT tier. */
  date: string;
  type: TxnType;
  /** "" for DEPOSIT / WITHDRAW. Stored uppercase. */
  ticker: string;
  name: string;
  sector: string;
  shares: number;
  /** paisa per share */
  price: number;
  /** paisa — cash amount (DEPOSIT/WITHDRAW) or gross dividend override */
  amount: number;
  /** SPLIT only: `ratioFrom` old shares become `ratioTo` new shares. */
  ratioFrom?: number;
  ratioTo?: number;
  /** Manual override of computed costs, to match a broker note exactly. */
  feeOverride?: Partial<FeeBreakdown>;
  note: string;
};

/**
 * An open (or partially consumed) parcel of shares.
 *
 * `cost` is the TOTAL fee-inclusive cost of the remaining `shares`, not a
 * per-share figure — keeping the total means partial sells can slice cost
 * proportionally and subtract, so the parcel's cost is conserved exactly with
 * no rounding leak.
 */
export type Lot = {
  /** id of the transaction that opened this lot */
  txnId: string;
  ticker: string;
  /** acquisition date — survives splits, picks the CGT rate tier */
  date: string;
  shares: number;
  /** paisa, fee-inclusive, for the remaining `shares` */
  cost: number;
};

/** One FIFO match: a slice of a lot consumed by a sale. */
export type RealizedSlice = {
  /** id of the SELL transaction */
  txnId: string;
  ticker: string;
  sellDate: string;
  /** acquisition date of the consumed lot */
  buyDate: string;
  shares: number;
  /** paisa — share of the sale's gross value attributable to this slice */
  proceeds: number;
  /** paisa — share of the sale's fees attributable to this slice */
  fees: number;
  /** paisa — fee-inclusive cost of the consumed slice */
  cost: number;
  /** paisa — `proceeds - fees - cost` (can be negative) */
  gain: number;
  /** percent rate applied to a positive gain */
  cgtRatePct: number;
  /** paisa — 0 when `gain <= 0` */
  cgt: number;
};

/** A dividend actually received, after withholding. */
export type DividendReceipt = {
  txnId: string;
  ticker: string;
  date: string;
  shares: number;
  /** paisa */
  gross: number;
  wht: number;
  net: number;
};

/** Tax charged on a bonus issue (Pakistan: a percent of the issue value). */
export type BonusTaxCharge = {
  txnId: string;
  ticker: string;
  date: string;
  shares: number;
  /** paisa — shares × issue price */
  value: number;
  tax: number;
};

/**
 * A CGT settlement actually debited by NCCPL, recorded from a broker statement.
 *
 * This is the only place real tax cash leaves the account. Per-trade `cgt` on a
 * `RealizedSlice` is an accrual — NCCPL nets gains against losses over the month
 * and the fiscal year, so what it finally collects is almost never the sum of
 * the per-trade figures.
 */
export type TaxPayment = {
  txnId: string;
  date: string;
  /** paisa */
  amount: number;
  note: string;
};

/** Per-ticker aggregate produced by the replay. */
export type PositionState = {
  ticker: string;
  name: string;
  sector: string;
  lots: Lot[];
  /** open shares (sum of `lots[].shares`) */
  shares: number;
  /** paisa, fee-inclusive (sum of `lots[].cost`) */
  cost: number;
  /**
   * paisa — realized trading P&L: proceeds − fees − cost.
   *
   * Before tax. CGT is accrued per slice but netted across the fiscal year, so
   * it belongs to `TaxYear.cgtDue` rather than to any one position — see
   * `cgtReserve` for what is actually owed.
   */
  realized: number;
  /** paisa — net dividends received */
  dividends: number;
  /** paisa — every fee ever paid on this ticker (buys and sells) */
  feesPaid: number;
  /**
   * paisa — CGT + dividend WHT + bonus tax booked against this ticker. WHT and
   * bonus tax are withheld at source; the CGT part is an accrual, not cash out.
   */
  taxesPaid: number;
  /** paisa — total cash ever put into this ticker (buy value + fees + rights) */
  invested: number;
  /** paisa — cash actually taken out (sale proceeds after fees + net dividends) */
  returned: number;
  firstDate: string;
  lastDate: string;
};

/** Non-fatal problem found while replaying — surfaced in the UI, never thrown. */
export type LedgerIssue = {
  txnId: string;
  date: string;
  ticker: string;
  message: string;
};

/** Everything a replay produces. */
export type LedgerState = {
  positions: Map<string, PositionState>;
  realized: RealizedSlice[];
  dividends: DividendReceipt[];
  bonusTaxes: BonusTaxCharge[];
  taxPayments: TaxPayment[];
  /**
   * paisa — capital contributed: deposits less withdrawals.
   *
   * The money you actually put in, and the only honest denominator for a
   * return. Summing what every buy cost instead counts the same rupee again
   * each time it is redeployed, which flatters a return by the number of times
   * the portfolio turned over. A tax settlement is a cost rather than a
   * withdrawal of capital, so it is not netted off here.
   */
  contributions: number;
  /** paisa — account charges booked via EXPENSE entries. A cost, not capital. */
  expenses: number;
  /**
   * paisa — derived account cash: deposits − outflows + inflows.
   *
   * Reconciles with the broker statement. Accrued CGT is deliberately NOT
   * deducted here — it leaves the account only via a `TAX` entry.
   */
  cash: number;
  issues: LedgerIssue[];
};
