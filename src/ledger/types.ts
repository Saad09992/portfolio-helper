// MONEY CONVENTION: every monetary field below is INTEGER PAISA (100 = ₨1),
// never rupee-floats. See src/money.ts. Share counts, ratios and percent rates
// are not money and stay plain numbers.

/**
 * Ledger event kinds.
 *
 * - BUY / SELL    — market trades; carry fees, and SELL carries CGT.
 * - DIVIDENDplain — cash dividend, taxed at `dividendWhtPct`.
 * - BONUS         — free shares; taxed at `bonusTaxPct` on their issue value.
 * - RIGHT         — rights subscription; new shares at the subscription price.
 * - SPLIT         — share split / consolidation; rescales open lots.
 * - DEPOSIT /
 *   WITHDRAW      — cash movements in and out of the brokerage account.
 */
export type TxnType =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "BONUS"
  | "RIGHT"
  | "SPLIT"
  | "DEPOSIT"
  | "WITHDRAW";

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
  /** paisa — net realized P&L: proceeds − fees − cost − cgt */
  realized: number;
  /** paisa — net dividends received */
  dividends: number;
  /** paisa — every fee ever paid on this ticker (buys and sells) */
  feesPaid: number;
  /** paisa — CGT + dividend WHT + bonus tax booked against this ticker */
  taxesPaid: number;
  /** paisa — total cash ever put into this ticker (buy value + fees + rights) */
  invested: number;
  /** paisa — total cash ever taken out (net sale proceeds + net dividends) */
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
  /** paisa — derived account cash: deposits − outflows + inflows */
  cash: number;
  issues: LedgerIssue[];
};
