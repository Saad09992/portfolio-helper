// The one place tables decide what "the visible rows" means.
//
// Every table in the app renders a full in-memory array — the ledger replay and
// every aggregate structurally need the complete transaction set, so paging can
// only ever be a rendering concern (see `src/hooks/useLedger.ts`). This module is
// that rendering concern, and nothing else: given all the rows and a description
// of the columns, it answers "which rows, in what order, on this page".
//
// Pure and DOM-free on purpose. Vitest runs in node here with no jsdom, so the
// only testable layer is the one that touches neither React nor the document —
// same discipline as `src/routes.ts` and `src/analytics.ts`.

import type { SortDir, SortState } from "../uiTypes";

export type { SortDir, SortState };

/** Page size meaning "no paging" — the escape hatch that keeps Ctrl-F useful. */
export const ALL_ROWS = -1;

export type ColumnDef<Row, K extends string> = {
  key: K;
  label: string;
  align?: "right";
  /**
   * The value this column sorts on. Strings compare with `localeCompare`,
   * numbers numerically; mixing the two within one column is a bug in the spec.
   * Omit together with `sortable` for display-only columns (Action, Note).
   *
   * `null` / `undefined` / `NaN` sort last in BOTH directions — a missing price
   * is absent, not small, and flipping the arrow shouldn't drag the holes to the
   * top.
   */
  value?: (row: Row) => string | number | null | undefined;
  /**
   * Direction applied on the first click of this column. Text reads best
   * ascending, magnitudes descending, so callers usually want "asc" for the
   * former and the default "desc" for the latter.
   */
  defaultDir?: SortDir;
  /** Defaults to true when `value` is present, false when it isn't. */
  sortable?: boolean;
};

export type TableSpec<Row, K extends string> = {
  columns: readonly ColumnDef<Row, K>[];
  /**
   * The haystack for free-text search. Returning several strings is cheaper than
   * concatenating them, since a match on the first short-circuits the rest.
   */
  search?: (row: Row) => readonly (string | null | undefined)[];
  /**
   * Categorical filters — type chips, a date range, a ticker. Composed with AND,
   * applied before sorting so the sort only touches rows that survive.
   */
  predicates?: readonly ((row: Row) => boolean)[];
  /**
   * Rows held at the bottom while a sort is active, so they can't interleave with
   * it. Holdings needs this for the synthetic `cash-*` row, which is not a
   * position and has no business sitting mid-table between two stocks.
   *
   * Only applies when a column is actually sorted. Unsorted means the caller's own
   * order is authoritative — and Holdings deliberately puts cash FIRST there (see
   * `buildHoldingsWithCash`), which pinning would otherwise silently undo.
   */
  pinLast?: (row: Row) => boolean;
  /**
   * When false the header toggles between the two directions and never reaches
   * "unsorted". Targets wants this: its default drift sort is load-bearing, and
   * "unsorted" there just means "arbitrary". Defaults to true.
   */
  allowUnsorted?: boolean;
};

export type PageWindow<Row> = {
  /** The rows to render — already filtered, sorted and sliced. */
  rows: Row[];
  /** 1-based, clamped into range. */
  page: number;
  pageCount: number;
  /** 1-based inclusive row numbers for "showing 51–100 of 357". Both 0 when empty. */
  from: number;
  to: number;
  /** How many rows survived filtering — NOT the size of the unfiltered input. */
  total: number;
};

export function columnByKey<Row, K extends string>(
  spec: TableSpec<Row, K>,
  key: K,
): ColumnDef<Row, K> | undefined {
  return spec.columns.find((column) => column.key === key);
}

export function isSortable<Row, K extends string>(column: ColumnDef<Row, K>): boolean {
  return column.sortable ?? column.value !== undefined;
}

/**
 * Advances the sort on `key`.
 *
 * A new column starts at its own `defaultDir`; clicking the active column walks
 * that direction to its opposite and then off again. Three clicks always return
 * you to the unsorted order, which is what makes the header safe to poke at —
 * unless `allowUnsorted` is false, in which case it just flips.
 */
export function nextSort<K extends string>(
  current: SortState<K>,
  key: K,
  defaultDir: SortDir = "desc",
  allowUnsorted = true,
): SortState<K> {
  if (current.key !== key) return { key, dir: defaultDir };
  const opposite: SortDir = defaultDir === "desc" ? "asc" : "desc";
  if (current.dir === defaultDir) return { key, dir: opposite };
  return allowUnsorted ? { key: null, dir: defaultDir } : { key, dir: defaultDir };
}

/**
 * Orders two sort values. Holes (null, undefined, NaN) always come last, so the
 * caller must apply `mult` only to a non-hole comparison — hence the separate
 * `holes` result rather than a plain number.
 */
function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): { cmp: number; directional: boolean } {
  const aHole = a === null || a === undefined || (typeof a === "number" && Number.isNaN(a));
  const bHole = b === null || b === undefined || (typeof b === "number" && Number.isNaN(b));
  if (aHole || bHole) {
    // Not directional: holes stay at the bottom whichever way the arrow points.
    return { cmp: aHole && bHole ? 0 : aHole ? 1 : -1, directional: false };
  }
  const cmp =
    typeof a === "string" && typeof b === "string"
      ? a.localeCompare(b)
      : Number(a) - Number(b);
  return { cmp, directional: true };
}

/**
 * Sorts a copy. Pinned rows are held at the bottom by comparing pinned-ness
 * first, so they neither move nor participate in the column comparison.
 *
 * With no active sort column the input order is returned untouched — including any
 * `pinLast` rows, because "unsorted" means the caller's order wins.
 */
export function sortRows<Row, K extends string>(
  rows: readonly Row[],
  spec: TableSpec<Row, K>,
  sort: SortState<K>,
): Row[] {
  const column = sort.key === null ? undefined : columnByKey(spec, sort.key);
  const value = column && isSortable(column) ? column.value : undefined;

  if (!value) return [...rows];

  const pinLast = spec.pinLast;
  const mult = sort.dir === "asc" ? 1 : -1;

  // Decorate with the original index so the sort is stable even where the
  // engine's isn't, and so `pinLast` alone leaves the rest untouched.
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      if (pinLast) {
        const aPinned = pinLast(a.row);
        const bPinned = pinLast(b.row);
        if (aPinned !== bPinned) return aPinned ? 1 : -1;
      }
      if (value) {
        const { cmp, directional } = compareValues(value(a.row), value(b.row));
        if (cmp !== 0) return directional ? cmp * mult : cmp;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

/**
 * Case-insensitive substring match over the spec's search fields, then every
 * predicate. An empty or whitespace-only query matches everything, so the search
 * box starts out transparent.
 */
export function matchRows<Row, K extends string>(
  rows: readonly Row[],
  spec: TableSpec<Row, K>,
  query: string,
): Row[] {
  const q = query.trim().toLowerCase();
  const search = spec.search;
  const predicates = spec.predicates ?? [];

  if (!q && predicates.length === 0) return [...rows];

  return rows.filter((row) => {
    for (const predicate of predicates) {
      if (!predicate(row)) return false;
    }
    if (!q || !search) return true;
    for (const field of search(row)) {
      if (field && field.toLowerCase().includes(q)) return true;
    }
    return false;
  });
}

/**
 * Slices one page out of `rows`.
 *
 * `page` is clamped rather than trusted: it can arrive from the URL, and a
 * shared `?lpage=9` link opened against a filtered two-page result should land
 * on page 2, not on a blank table.
 */
export function paginate<Row>(
  rows: readonly Row[],
  page: number,
  pageSize: number,
): PageWindow<Row> {
  const total = rows.length;

  if (pageSize === ALL_ROWS || pageSize <= 0) {
    return {
      rows: [...rows],
      page: 1,
      pageCount: 1,
      from: total === 0 ? 0 : 1,
      to: total,
      total,
    };
  }

  // An empty result is one empty page, not zero pages — "Page 1 of 0" reads as
  // a bug to anyone looking at it.
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (safePage - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return {
    rows: slice,
    page: safePage,
    pageCount,
    from: slice.length === 0 ? 0 : start + 1,
    to: start + slice.length,
    total,
  };
}

export type ViewState<K extends string> = {
  query: string;
  sort: SortState<K>;
  page: number;
  pageSize: number;
};

/**
 * filter -> predicates -> sort -> slice.
 *
 * The order matters: sorting before filtering would waste work on rows nobody
 * sees, and slicing before sorting would page through the wrong sequence
 * entirely.
 */
export function buildView<Row, K extends string>(
  rows: readonly Row[],
  spec: TableSpec<Row, K>,
  view: ViewState<K>,
): PageWindow<Row> {
  const matched = matchRows(rows, spec, view.query);
  const sorted = sortRows(matched, spec, view.sort);
  return paginate(sorted, view.page, view.pageSize);
}

/**
 * Inclusive both ends, and an absent bound means unbounded.
 *
 * Compares `YYYY-MM-DD` strings lexically, which is what the rest of the ledger
 * does (`sortTransactions`, the ledger row sort) — no Date parsing, so no
 * timezone can shift a boundary date onto the wrong side of the filter.
 */
export function dateInRange(date: string, from?: string, to?: string): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}
