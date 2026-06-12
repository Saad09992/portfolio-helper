export type Payout = {
  announcementDate: string;
  bookClosureDate: string;
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

export type TargetAllocation = {
  id: string;
  mode: "sector" | "ticker";
  key: string;
  targetWeight: number;
};

export type InvestmentEntry = {
  id: string;
  date: string;
  label: string;
  amount: number;
  valueEom: number;
};
