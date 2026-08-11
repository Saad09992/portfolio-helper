// Allocation slices for the portfolio-mix donut.
//
// The donut used to answer one question — what share of today's market value is
// this? — which hides the more interesting one: how does that share compare to
// the share of the money you actually put in. A position can be 25% of the book
// on 19% of the cost (it ran up) or 16% on 23% (it fell). Carrying both weights
// on every slice is what makes that readable at a glance.
//
// Pure so it can be tested: Vitest runs in node here with no jsdom, so the
// arithmetic lives in a module and the component stays a thin shell over it.

export type AllocationBasis = "market" | "cost";
export type AllocationGroup = "sector" | "ticker";

/** The minimum a holding must carry to be allocated. Money is integer paisa. */
export type AllocationInput = {
  ticker: string;
  sector: string;
  marketValue: number;
  costValue: number;
};

export type AllocationSlice = {
  /** Link target — a ticker, or a sector name to filter Holdings by. */
  key: string;
  label: string;
  marketValue: number;
  costValue: number;
  /** Fractions of the respective totals, 0..1. Zero when the total is zero. */
  marketWeight: number;
  costWeight: number;
  /**
   * The slice's own return as a fraction — `marketValue / costValue - 1`.
   *
   * The reason this exists: the two weights are shares of a pie, and shares sum
   * to 100% however the money went. A slice's market weight can sit ABOVE its
   * cost weight while it is losing money, as long as it lost less than the rest
   * of the book. Without a return column that pair reads as profit, which is
   * exactly the wrong conclusion.
   *
   * Zero when there is no cost — a bonus issue has no basis to return against.
   */
  returnPct: number;
};

export function valueFor(slice: AllocationSlice, basis: AllocationBasis): number {
  return basis === "market" ? slice.marketValue : slice.costValue;
}

export function weightFor(slice: AllocationSlice, basis: AllocationBasis): number {
  return basis === "market" ? slice.marketWeight : slice.costWeight;
}

export const BASIS_LABEL: Record<AllocationBasis, string> = {
  market: "Market value",
  cost: "Cost basis",
};

/**
 * Group the holdings, weight them both ways, and order them by `basis`.
 *
 * Ordering is part of the contract: the donut and the legend read the same
 * array, so a legend row's index is its slice's `dataIndex` and its colour.
 * Sorting here rather than in the component is what keeps the two in step.
 *
 * A slice with no cost — a bonus issue, say — is legitimate and keeps a zero
 * cost weight rather than being dropped.
 */
export function buildAllocationSlices(
  holdings: readonly AllocationInput[],
  groupBy: AllocationGroup,
  basis: AllocationBasis,
): AllocationSlice[] {
  const grouped = new Map<string, AllocationSlice>();

  for (const holding of holdings) {
    const key = groupBy === "ticker" ? holding.ticker : holding.sector;
    // A blank sector would otherwise open an unfiltered Holdings view and read
    // as a bug; name it the way the rest of the app does.
    const label = key || "Uncategorized";
    const existing = grouped.get(label);
    if (existing) {
      existing.marketValue += holding.marketValue;
      existing.costValue += holding.costValue;
    } else {
      grouped.set(label, {
        key: label,
        label,
        marketValue: holding.marketValue,
        costValue: holding.costValue,
        marketWeight: 0,
        costWeight: 0,
        returnPct: 0,
      });
    }
  }

  const slices = [...grouped.values()];
  const marketTotal = slices.reduce((sum, s) => sum + s.marketValue, 0);
  const costTotal = slices.reduce((sum, s) => sum + s.costValue, 0);

  for (const slice of slices) {
    slice.marketWeight = marketTotal > 0 ? slice.marketValue / marketTotal : 0;
    slice.costWeight = costTotal > 0 ? slice.costValue / costTotal : 0;
    slice.returnPct = slice.costValue > 0 ? slice.marketValue / slice.costValue - 1 : 0;
  }

  // Ties broken by name so the order — and therefore every slice colour — is
  // stable across re-renders rather than depending on Map insertion order.
  return slices.sort(
    (a, b) => valueFor(b, basis) - valueFor(a, basis) || a.label.localeCompare(b.label),
  );
}

/** Total of the active basis — what the donut's centre reports. */
export function allocationTotal(
  slices: readonly AllocationSlice[],
  basis: AllocationBasis,
): number {
  return slices.reduce((sum, s) => sum + valueFor(s, basis), 0);
}

/**
 * The whole book's return — the benchmark every slice's `returnPct` should be
 * read against, since a slice gains weight by beating this number rather than
 * by making money.
 */
export function allocationReturn(slices: readonly AllocationSlice[]): number {
  const market = allocationTotal(slices, "market");
  const cost = allocationTotal(slices, "cost");
  return cost > 0 ? market / cost - 1 : 0;
}
