// Hash-based routing. Grammar: #/<page>[/<entity>][?k=v&k=v]
//
//   #/overview?range=ytd&tmap=ticker
//   #/stocks/ENGRO
//   #/tax/2025-26
//   #/holdings?q=luck&sort=weight&dir=desc
//
// The path segment is WHAT you are looking at (a page, and optionally one
// entity — a ticker or a fiscal year); the query is HOW you are looking at it
// (range, filters, toggles). That split decides history behaviour: entity
// changes are pushed, query changes are replaced. See `useHashRoute`.
//
// Everything here is pure and DOM-free so it can be unit-tested under Vitest's
// node environment — the repo has no jsdom.

export type PageId =
  | "overview"
  | "holdings"
  | "ledger"
  | "stocks"
  | "targets"
  | "tax"
  | "income"
  | "invest"
  | "settings";

export const PAGES: readonly PageId[] = [
  "overview",
  "holdings",
  "ledger",
  "stocks",
  "targets",
  "tax",
  "income",
  "invest",
  "settings",
] as const;

export const PAGE_LABELS: Record<PageId, string> = {
  overview: "Overview",
  holdings: "Holdings",
  ledger: "Ledger",
  stocks: "Stocks",
  targets: "Targets",
  tax: "Tax",
  income: "Income",
  invest: "Invest",
  settings: "Settings",
};

/** Pages whose entity segment is a ticker, and so is upper-cased on parse. */
const TICKER_ENTITY_PAGES: ReadonlySet<PageId> = new Set<PageId>(["stocks"]);

export type Route = {
  page: PageId;
  /** Second path segment: a ticker on /stocks, a fiscal year on /tax. */
  entity: string | null;
  query: Record<string, string>;
};

export const DEFAULT_PAGE: PageId = "overview";

export const DEFAULT_ROUTE: Route = { page: DEFAULT_PAGE, entity: null, query: {} };

function isPageId(value: string): value is PageId {
  return (PAGES as readonly string[]).includes(value);
}

/** Tolerates a bad `%` escape — `decodeURIComponent` throws on e.g. "%zz". */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Total function: never throws, always yields a usable Route. An unknown or
 * missing page collapses to `overview` and drops the entity with it, so a stale
 * link like `#/nope/ENGRO` can't leave an entity attached to the wrong page.
 */
export function parseHash(hash: string): Route {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const [pathPart, ...queryParts] = raw.split("?");
  const queryPart = queryParts.join("?");

  const segments = pathPart
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const pageRaw = safeDecode(segments[0] ?? "").toLowerCase();
  if (!isPageId(pageRaw)) return { ...DEFAULT_ROUTE, query: parseQuery(queryPart) };

  const entityRaw = segments[1] ? safeDecode(segments[1]) : "";
  const entity = entityRaw
    ? TICKER_ENTITY_PAGES.has(pageRaw)
      ? entityRaw.toUpperCase()
      : entityRaw
    : null;

  return { page: pageRaw, entity, query: parseQuery(queryPart) };
}

function parseQuery(queryPart: string): Record<string, string> {
  const query: Record<string, string> = {};
  if (!queryPart) return query;
  for (const pair of queryPart.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const key = safeDecode(eq === -1 ? pair : pair.slice(0, eq)).trim();
    if (!key) continue;
    const value = eq === -1 ? "" : safeDecode(pair.slice(eq + 1));
    if (value === "") continue; // absent and empty mean the same thing
    query[key] = value;
  }
  return query;
}

/**
 * Keys are sorted so the same view always serializes to the same string — that
 * makes URLs stable to share and lets `useHashRoute` skip no-op writes.
 * Encoding is mandatory: an unescaped `#` from a search box would truncate the
 * hash and silently drop everything after it.
 */
export function serializeRoute(route: Route): string {
  const path = route.entity
    ? `${route.page}/${encodeURIComponent(route.entity)}`
    : route.page;

  const entries = Object.entries(route.query)
    .filter(([key, value]) => key !== "" && value !== "" && value != null)
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return `#/${path}`;

  const query = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return `#/${path}?${query}`;
}

export function pageHref(page: PageId): string {
  return serializeRoute({ page, entity: null, query: {} });
}

/** The cross-link primitive: every chart mark and ticker cell points here. */
export function stockHref(ticker: string): string {
  return serializeRoute({
    page: "stocks",
    entity: ticker.toUpperCase(),
    query: {},
  });
}

export function taxHref(fy: string): string {
  return serializeRoute({ page: "tax", entity: fy, query: {} });
}

/** Sector drill-down: reuses the Holdings search box as the filter. */
export function holdingsQueryHref(q: string): string {
  return serializeRoute({ page: "holdings", entity: null, query: { q } });
}

/**
 * Imperative navigation, for canvas-rendered charts only.
 *
 * Everything else in the app navigates with a real `<a href>`, which gets
 * middle-click, cmd-click and keyboard activation for free. An ECharts canvas
 * cannot host an anchor, so its click handler assigns the hash instead — which
 * fires `hashchange` and lands in `useHashRoute` like any other navigation.
 */
export function goTo(href: string): void {
  if (typeof window !== "undefined") window.location.hash = href;
}
