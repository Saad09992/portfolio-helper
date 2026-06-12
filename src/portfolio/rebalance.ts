import { CADENCE_DAYS, REBALANCE, TARGET_DEFAULTS } from "../constants";
import type { RebalanceCadence } from "../types";

export type DriftStatus = "critical" | "warn" | "ontrack";

export function driftStatusFor(
  absDrift: number,
  warn: number = TARGET_DEFAULTS.WARN_THRESHOLD,
  critical: number = TARGET_DEFAULTS.CRITICAL_THRESHOLD,
): DriftStatus {
  if (absDrift >= critical) return "critical";
  if (absDrift >= warn) return "warn";
  return "ontrack";
}

/** Whether a target's |gap value| in PKR clears the noise floor and is worth surfacing. */
export function isRebalanceSuggestion(
  gapValuePkr: number,
  totalValuePkr: number,
  cadenceOverride = false,
): boolean {
  if (cadenceOverride && Math.abs(gapValuePkr) > 0) return true;
  const floor = Math.max(REBALANCE.MIN_PKR, totalValuePkr * REBALANCE.MIN_PORTFOLIO_FRACTION);
  return Math.abs(gapValuePkr) > floor;
}

export type CadenceState = "due" | "overdue" | "soon" | "fresh" | "never";

export function cadenceState(
  lastRebalancedAt: string | null | undefined,
  cadence: RebalanceCadence,
  now: Date,
): { state: CadenceState; daysUntilDue: number } {
  if (!lastRebalancedAt) {
    return { state: "never", daysUntilDue: 0 };
  }
  const last = new Date(lastRebalancedAt);
  if (Number.isNaN(last.getTime())) {
    return { state: "never", daysUntilDue: 0 };
  }
  const cadenceDays = CADENCE_DAYS[cadence];
  const dueAtMs = last.getTime() + cadenceDays * 86400_000;
  const diffMs = dueAtMs - now.getTime();
  const daysUntilDue = Math.round(diffMs / 86400_000);

  if (daysUntilDue < -2) return { state: "overdue", daysUntilDue };
  if (daysUntilDue <= 2) return { state: "due", daysUntilDue };
  if (daysUntilDue <= 7) return { state: "soon", daysUntilDue };
  return { state: "fresh", daysUntilDue };
}
