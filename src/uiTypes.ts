export type SortDir = "asc" | "desc";

/**
 * Which column a table is sorted by, and which way. `key: null` means unsorted —
 * the third state of the header toggle, where rows fall back to input order.
 */
export type SortState<K extends string> = { key: K | null; dir: SortDir };

export type HoldingsSortKey =
  | "ticker"
  | "name"
  | "sector"
  | "shares"
  | "costBasis"
  | "price"
  | "dayChangePct"
  | "marketValue"
  | "weight"
  | "pnlToday"
  | "gainLoss";

export type HoldingsSortState = SortState<HoldingsSortKey>;
