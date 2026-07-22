// MONEY CONVENTION: every monetary field below is INTEGER PAISA (100 = ₨1),
// never rupee-floats. See src/money.ts. Ratios/weights/percents/counts and the
// KSE100 index level are not money and remain plain numbers.

export type Payout = {
  announcementDate: string;
  bookClosureDate: string;
  /** paisa */
  dividendPerShare: number;
};

export type Holding = {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  account: string;
  shares: number;
  price: number;
  costBasis: number;
  dayChangePct: number;
  dividendPerShare: number;
  payoutDate: string;
  payouts?: Payout[];
};

export type DerivedHolding = Holding & {
  marketValue: number;
  costValue: number;
  gainLoss: number;
  weight: number;
};

export type SectorBucket = {
  sector: string;
  value: number;
  weight: number;
  holdings: number;
};

export type CashBuckets = {
  available: number;
};

export type RebalanceCadence = "weekly" | "monthly" | "quarterly" | "yearly";

export type TargetAllocation = {
  id: string;
  mode: "sector" | "ticker";
  key: string;
  targetWeight: number;
  warnThreshold?: number;
  criticalThreshold?: number;
  cadence?: RebalanceCadence;
  lastRebalancedAt?: string | null;
};

export type InvestmentEntry = {
  id: string;
  date: string;
  label: string;
  amount: number;
  valueEom: number;
};
