import type { CadenceState } from "../portfolio/rebalance";

export function CadenceBadge({ state, days }: { state: CadenceState; days: number }) {
  const label = (() => {
    if (state === "never") return "Never rebalanced";
    if (state === "overdue") return `Overdue ${Math.abs(days)}d`;
    if (state === "due") return days <= 0 ? `Due ${Math.abs(days)}d ago` : `Due in ${days}d`;
    if (state === "soon") return `Soon (${days}d)`;
    return `Fresh (${days}d)`;
  })();
  return <span className={`drift-cadence-badge drift-cadence-badge--${state}`}>{label}</span>;
}
