export type SortDir = "asc" | "desc";

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

export type HoldingsSortState = { key: HoldingsSortKey | null; dir: SortDir };
