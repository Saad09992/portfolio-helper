export type Payout = {
  announcementDate: string;
  bookClosureDate: string;
  dividendPerShare: number;
};

export type AssetClass = "stock" | "crypto";

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
  /** "stock" (PSX) or "crypto". Defaults to "stock" for legacy data. */
  assetClass?: AssetClass;
  /** CoinGecko id — crypto price match key (stocks match by ticker). */
  coinId?: string;
  /** Last known native USD price (crypto primary display). */
  usdPrice?: number;
  /** Native USD average cost (crypto primary; entered Binance-style). */
  usdCostBasis?: number;
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

export type AssetClassBucket = {
  assetClass: string;
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
