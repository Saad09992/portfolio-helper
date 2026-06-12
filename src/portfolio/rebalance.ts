import { DRIFT, REBALANCE } from "../constants";

export type DriftStatus = "severe" | "moderate" | "ontrack";

export function driftStatus(absDrift: number): DriftStatus {
  if (absDrift >= DRIFT.SEVERE) return "severe";
  if (absDrift >= DRIFT.MODERATE) return "moderate";
  return "ontrack";
}

/** Whether a target's |gap value| in PKR clears the noise floor and is worth surfacing. */
export function isRebalanceSuggestion(gapValuePkr: number, totalValuePkr: number): boolean {
  const floor = Math.max(REBALANCE.MIN_PKR, totalValuePkr * REBALANCE.MIN_PORTFOLIO_FRACTION);
  return Math.abs(gapValuePkr) > floor;
}
