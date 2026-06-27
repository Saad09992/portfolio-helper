import type {
  DerivedHolding,
  InvestmentEntry,
  RebalanceCadence,
  TargetAllocation,
} from "./types";
import type { CadenceState, DriftStatus } from "./portfolio/rebalance";

/** A target allocation enriched with live drift / cadence computations. */
export type TargetRow = Omit<
  TargetAllocation,
  "warnThreshold" | "criticalThreshold" | "cadence"
> & {
  warnThreshold: number;
  criticalThreshold: number;
  cadence: RebalanceCadence;
  currentWeight: number;
  drift: number;
  gapValue: number;
  absDrift: number;
  status: DriftStatus;
  price: number;
  shares: number;
  cadenceState: CadenceState;
  daysUntilDue: number;
};

export type UpcomingDividend = {
  ticker: string;
  holding: DerivedHolding;
  date: string;
  dps: number;
};

export type InvestmentRow = InvestmentEntry & {
  total: number;
  pnlValue: number;
  pnlPct: number;
};

export type InvestmentSummary = {
  totalInvested: number;
  latestValue: number;
  pnlValue: number;
  pnlPct: number;
  xirrPct: number;
  count: number;
};
