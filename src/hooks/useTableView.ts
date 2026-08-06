// Table view state: what's searched, sorted, filtered and which page.
//
// All the interesting logic lives in `src/table/tableView.ts`, which is pure and
// therefore testable — Vitest runs in node here with no jsdom, so this file is
// deliberately a thin shell over it. Keep logic out of it (same bargain as
// `useHashRoute`).
//
// Two modes, one hook:
//   - pass a `store` and the state lives in the URL hash, so the view is
//     shareable and survives a reload.
//   - omit it and the state is local `useState` — right for the small nested
//     tables, where a URL param per table would be param soup for no gain.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TABLE, UI_LIMITS } from "../constants";
import {
  ALL_ROWS,
  buildView,
  columnByKey,
  isSortable,
  nextSort,
  type PageWindow,
  type SortState,
  type TableSpec,
} from "../table/tableView";

/**
 * The URL seam. `useHashRoute` satisfies this directly — passing the pieces
 * rather than importing the router keeps this hook testable in principle and
 * usable from a page that isn't routed.
 */
export type TableStore = {
  query: Record<string, string>;
  setParam: (key: string, value: string | null) => void;
};

export type FilterConfig<Row> = {
  /**
   * Filter names, used as URL keys (namespaced) and as the keys of the `filters`
   * bag. Keep them short: they end up in the hash.
   */
  keys: readonly string[];
  /**
   * Turns the current filter values into row predicates. Must be referentially
   * stable — wrap it in `useCallback` if it closes over props, or the whole
   * filter/sort/slice pass re-runs on every render.
   */
  toPredicates: (
    filters: Record<string, string>,
  ) => readonly ((row: Row) => boolean)[];
};

export type TableViewApi<Row, K extends string> = PageWindow<Row> & {
  /** The live search text — updates on every keystroke. */
  query: string;
  sort: SortState<K>;
  pageSize: number;
  filters: Record<string, string>;
  /** True when any search text or filter is narrowing the set. Drives the copy. */
  active: boolean;
  /** Row count before search and filters — what the panel header should show. */
  sourceTotal: number;
  setQuery: (value: string) => void;
  setFilter: (key: string, value: string | null) => void;
  toggleSort: (key: K) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
};

type Options<Row, K extends string> = {
  /** Omit for local state; pass `{ query: route.query, setParam }` for URL state. */
  store?: TableStore;
  /**
   * Prefix for this table's URL keys, so two tables on one page don't collide.
   * `""` means bare `q`/`sort`/`dir` — reserved for a page's primary table, and
   * required for Holdings, whose bare params are a documented shareable link.
   */
  ns?: string;
  pageSize?: number;
  defaultSort?: SortState<K>;
  filters?: FilterConfig<Row>;
  /**
   * Page and search reset when this changes — the selected fiscal year or ticker.
   * Without it, drilling into a different stock leaves you on page 4 of a table
   * that now has one page.
   */
  resetKey?: string | null;
};

const NO_FILTERS: Record<string, string> = {};

/**
 * `ns`-prefixed URL key. `""` means bare keys (`q`, `sort`, `dir`) — reserved for
 * a page's primary table, and required for Holdings, whose bare params are a
 * documented shareable link.
 */
export function paramKey(ns: string, name: string): string {
  return ns ? `${ns}${name}` : name;
}

/**
 * The params a sort state writes. Pure so the URL contract is testable without a
 * DOM — Vitest has no jsdom here, so this is the only way to cover the write side.
 *
 * Defaults are emitted as `null` so `setParam` deletes them, which is what keeps
 * `#/holdings?q=luck&sort=weight` short rather than spelling out `dir=desc`.
 */
export function sortParams<K extends string>(
  next: SortState<K>,
): { sort: string | null; dir: string | null } {
  if (next.key === null) return { sort: null, dir: null };
  return { sort: next.key, dir: next.dir === "asc" ? "asc" : null };
}

/** `null` for the default size, `"all"` for no paging, else the number. */
export function pageSizeParam(size: number, defaultSize: number): string | null {
  if (size === ALL_ROWS) return "all";
  return size === defaultSize ? null : String(size);
}

/** `null` for page 1, so the first page never appears in the URL. */
export function pageParam(page: number): string | null {
  return page <= 1 ? null : String(page);
}

/** Inverse of `pageSizeParam`. An unknown value falls back to the default. */
export function parsePageSize(
  raw: string | undefined,
  defaultSize: number,
  allowed: readonly number[],
): number {
  if (raw === "all") return ALL_ROWS;
  const parsed = Number(raw);
  return allowed.includes(parsed) ? parsed : defaultSize;
}

export function useTableView<Row, K extends string>(
  rows: readonly Row[],
  spec: TableSpec<Row, K>,
  options: Options<Row, K> = {},
): TableViewApi<Row, K> {
  const {
    store,
    ns = "",
    pageSize: defaultPageSize = TABLE.DEFAULT_PAGE_SIZE,
    defaultSort,
    filters: filterConfig,
    resetKey = null,
  } = options;

  const key = useCallback((name: string) => paramKey(ns, name), [ns]);
  const routed = store !== undefined;

  // ── State ────────────────────────────────────────────────────────────────
  //
  // Search is local in both modes so typing is instant, then mirrored into the
  // URL on a debounce. Everything else is discrete and reads straight off its
  // source, which is what makes the first render correct with no effects — the
  // render-to-string smoke tests depend on that.

  const urlQuery = routed ? (store.query[key("q")] ?? "") : "";
  const [localQuery, setLocalQuery] = useState(urlQuery);
  const [localSort, setLocalSort] = useState<SortState<K>>(
    defaultSort ?? { key: null, dir: "desc" },
  );
  const [localPage, setLocalPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(defaultPageSize);
  const [localFilters, setLocalFilters] = useState<Record<string, string>>(NO_FILTERS);

  const query = localQuery;

  const sort: SortState<K> = useMemo(() => {
    if (!routed) return localSort;
    const raw = store.query[key("sort")];
    const column = raw === undefined ? undefined : columnByKey(spec, raw as K);
    // An unknown or unsortable column in the URL falls back to the default rather
    // than sorting by nothing — a stale link shouldn't look broken.
    if (!column || !isSortable(column)) return defaultSort ?? { key: null, dir: "desc" };
    return { key: raw as K, dir: store.query[key("dir")] === "asc" ? "asc" : "desc" };
  }, [routed, store?.query, key, spec, defaultSort, localSort]);

  const pageSize = useMemo(() => {
    if (!routed) return localPageSize;
    return parsePageSize(store.query[key("size")], defaultPageSize, TABLE.PAGE_SIZES);
  }, [routed, store?.query, key, defaultPageSize, localPageSize]);

  const page = routed ? Number(store.query[key("page")]) || 1 : localPage;

  const filters = useMemo(() => {
    const keys = filterConfig?.keys;
    if (!keys || keys.length === 0) return NO_FILTERS;
    if (!routed) return localFilters;
    const out: Record<string, string> = {};
    for (const name of keys) {
      const value = store.query[key(name)];
      if (value) out[name] = value;
    }
    return out;
  }, [filterConfig?.keys, routed, store?.query, key, localFilters]);

  // ── Derivation ───────────────────────────────────────────────────────────

  const toPredicates = filterConfig?.toPredicates;
  const effectiveSpec = useMemo<TableSpec<Row, K>>(() => {
    if (!toPredicates) return spec;
    return { ...spec, predicates: toPredicates(filters) };
  }, [spec, toPredicates, filters]);

  const pageWindow = useMemo(
    () => buildView(rows, effectiveSpec, { query, sort, page, pageSize }),
    [rows, effectiveSpec, query, sort, page, pageSize],
  );

  // ── Writers ──────────────────────────────────────────────────────────────

  // Search -> URL, debounced. `mirror` records the last value this side wrote so
  // an inbound route change (back/forward, a pasted link) can be told apart from
  // our own echo.
  //
  // It holds the TRIMMED text, because that is what goes in the URL. Storing the
  // raw value would make a trailing space look like an external change and echo
  // the trimmed string back into the input — deleting the space just typed, so
  // "oil " + "gas" came out "oilgas".
  const mirror = useRef(urlQuery.trim());
  useEffect(() => {
    if (!routed) return;
    const timer = setTimeout(() => {
      mirror.current = localQuery.trim();
      store.setParam(key("q"), mirror.current || null);
      // Folded into the same debounced write rather than fired per keystroke:
      // `paginate` clamps a stale page in the meantime, so the view is never
      // wrong, and Safari throttles `replaceState` to ~100 calls per 30s.
      store.setParam(key("page"), null);
    }, UI_LIMITS.SEARCH_URL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [routed, localQuery, store, key]);

  useEffect(() => {
    if (!routed) return;
    if (urlQuery === mirror.current) return;
    mirror.current = urlQuery;
    setLocalQuery(urlQuery);
  }, [routed, urlQuery]);

  // A new entity (fiscal year, ticker) is a different dataset — start clean.
  const lastResetKey = useRef(resetKey);
  useEffect(() => {
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    setLocalQuery("");
    setLocalPage(1);
    if (routed) {
      store.setParam(key("q"), null);
      store.setParam(key("page"), null);
    }
  }, [resetKey, routed, store, key]);

  const setQuery = useCallback((value: string) => {
    setLocalQuery(value);
    if (!routed) setLocalPage(1);
  }, [routed]);

  const setFilter = useCallback(
    (name: string, value: string | null) => {
      if (routed) {
        store.setParam(key(name), value);
        store.setParam(key("page"), null);
      } else {
        setLocalFilters((current) => {
          const next = { ...current };
          if (value === null || value === "") delete next[name];
          else next[name] = value;
          return next;
        });
        setLocalPage(1);
      }
    },
    [routed, store, key],
  );

  const toggleSort = useCallback(
    (columnKey: K) => {
      const column = columnByKey(effectiveSpec, columnKey);
      if (!column || !isSortable(column)) return;
      const next = nextSort(
        sort,
        columnKey,
        column.defaultDir ?? "desc",
        effectiveSpec.allowUnsorted ?? true,
      );
      if (routed) {
        // `setParam` composes within a tick (it updates its own ref), so these
        // three writes land as one history entry.
        const params = sortParams(next);
        store.setParam(key("sort"), params.sort);
        store.setParam(key("dir"), params.dir);
        store.setParam(key("page"), null);
      } else {
        setLocalSort(next);
        setLocalPage(1);
      }
    },
    [effectiveSpec, sort, routed, store, key],
  );

  const setPage = useCallback(
    (next: number) => {
      if (routed) store.setParam(key("page"), pageParam(next));
      else setLocalPage(Math.max(1, next));
    },
    [routed, store, key],
  );

  const setPageSize = useCallback(
    (size: number) => {
      if (routed) {
        store.setParam(key("size"), pageSizeParam(size, defaultPageSize));
        store.setParam(key("page"), null);
      } else {
        setLocalPageSize(size);
        setLocalPage(1);
      }
    },
    [routed, store, key, defaultPageSize],
  );

  const active = query.trim() !== "" || Object.keys(filters).length > 0;

  return {
    ...pageWindow,
    query,
    sort,
    pageSize,
    filters,
    active,
    sourceTotal: rows.length,
    setQuery,
    setFilter,
    toggleSort,
    setPage,
    setPageSize,
  };
}
