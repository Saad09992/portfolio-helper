// Guards the one URL contract in the app that must not move: the Holdings table
// reads and writes BARE `q` / `sort` / `dir` params, documented in `src/routes.ts`
// and produced by `holdingsQueryHref` for the Overview sector drill-down.

import { describe, expect, it } from "vitest";
import type { DerivedHolding } from "../types";
import { holdingsQueryHref, parseHash, serializeRoute } from "../routes";
import { buildView, columnByKey, matchRows, nextSort, sortRows } from "../table/tableView";
import type { HoldingsSortKey } from "../uiTypes";
import { HOLDINGS_SPEC, pnlToday } from "./holdingsTable";

const holding = (o: Partial<DerivedHolding> & { id: string }): DerivedHolding => ({
  ticker: "",
  name: "",
  sector: "",
  account: "PSX",
  shares: 0,
  price: 0,
  costBasis: 0,
  dayChangePct: 0,
  dividendPerShare: 0,
  payoutDate: "",
  marketValue: 0,
  costValue: 0,
  gainLoss: 0,
  weight: 0,
  ...o,
});

// Cash first, exactly as `buildHoldingsWithCash` produces it.
const rows: DerivedHolding[] = [
  holding({ id: "cash-available", ticker: "CASH", name: "Available Cash", sector: "Cash", marketValue: 500, weight: 0.05 }),
  holding({ id: "h1", ticker: "LUCK", name: "Lucky Cement", sector: "Materials", marketValue: 3000, weight: 0.3, gainLoss: 400 }),
  holding({ id: "h2", ticker: "OGDC", name: "Oil & Gas Development Co.", sector: "Energy", marketValue: 1000, weight: 0.1, gainLoss: -200 }),
  holding({ id: "h3", ticker: "ENGRO", name: "Engro Corp", sector: "Materials", marketValue: 2000, weight: 0.2, gainLoss: 100 }),
];

const ids = (list: readonly DerivedHolding[]) => list.map((r) => r.id);

describe("HOLDINGS_SPEC columns", () => {
  it("covers all eleven HoldingsSortKey values", () => {
    const keys: HoldingsSortKey[] = [
      "ticker", "name", "sector", "shares", "costBasis", "price",
      "dayChangePct", "marketValue", "weight", "pnlToday", "gainLoss",
    ];
    for (const key of keys) {
      expect(columnByKey(HOLDINGS_SPEC, key), key).toBeDefined();
    }
    expect(HOLDINGS_SPEC.columns).toHaveLength(keys.length);
  });

  it("sorts the text columns ascending on first click, numbers descending", () => {
    for (const key of ["ticker", "name", "sector"] as const) {
      expect(columnByKey(HOLDINGS_SPEC, key)?.defaultDir, key).toBe("asc");
    }
    for (const key of ["marketValue", "weight", "gainLoss"] as const) {
      // Undefined means the desc default in `nextSort`.
      expect(columnByKey(HOLDINGS_SPEC, key)?.defaultDir ?? "desc", key).toBe("desc");
    }
  });
});

describe("the cash row", () => {
  it("stays FIRST while unsorted — the page's own order wins", () => {
    expect(ids(sortRows(rows, HOLDINGS_SPEC, { key: null, dir: "desc" }))[0])
      .toBe("cash-available");
  });

  it("moves LAST under every sort key, in both directions", () => {
    for (const column of HOLDINGS_SPEC.columns) {
      for (const dir of ["asc", "desc"] as const) {
        const out = sortRows(rows, HOLDINGS_SPEC, { key: column.key, dir });
        expect(ids(out).at(-1), `${column.key}/${dir}`).toBe("cash-available");
      }
    }
  });

  it("does not distort the ordering of the real positions around it", () => {
    const out = sortRows(rows, HOLDINGS_SPEC, { key: "marketValue", dir: "desc" });
    expect(ids(out)).toEqual(["h1", "h3", "h2", "cash-available"]);
  });
});

describe("the sort cycle", () => {
  it("is desc -> asc -> unsorted for a numeric column", () => {
    // The cycle Holdings has always had. Reversing it would silently change what
    // a shared `?sort=weight` link shows after one click.
    const dflt = columnByKey(HOLDINGS_SPEC, "weight")?.defaultDir ?? "desc";
    const unsorted = { key: null as HoldingsSortKey | null, dir: "desc" as const };
    let next = nextSort(unsorted, "weight", dflt);
    expect(next).toEqual({ key: "weight", dir: "desc" });
    next = nextSort(next, "weight", dflt);
    expect(next).toEqual({ key: "weight", dir: "asc" });
    next = nextSort(next, "weight", dflt);
    expect(next.key).toBeNull();
  });
});

describe("search", () => {
  it("matches ticker, name and sector", () => {
    expect(ids(matchRows(rows, HOLDINGS_SPEC, "luck"))).toEqual(["h1"]);
    expect(ids(matchRows(rows, HOLDINGS_SPEC, "engro corp"))).toEqual(["h3"]);
    expect(ids(matchRows(rows, HOLDINGS_SPEC, "materials"))).toEqual(["h1", "h3"]);
  });

  it("still matches the sector strings holdingsQueryHref puts in the URL", () => {
    // The Overview donut links to `?q=<sector>`; an ampersand and spaces must
    // survive the round trip and still match.
    const href = holdingsQueryHref("Oil & Gas Development Co.");
    const q = parseHash(href).query.q;
    expect(q).toBe("Oil & Gas Development Co.");
    expect(ids(matchRows(rows, HOLDINGS_SPEC, q))).toEqual(["h2"]);
  });
});

describe("the bare URL params", () => {
  it("round-trips q, sort and dir with no namespace prefix", () => {
    const hash = "#/holdings?dir=desc&q=luck&sort=weight";
    const route = parseHash(hash);
    expect(route.query).toEqual({ q: "luck", sort: "weight", dir: "desc" });
    expect(serializeRoute(route)).toBe(hash);
  });

  it("serializes a sorted, filtered view to exactly those keys", () => {
    // `dir=desc` is the default and is omitted by the hook, so the shortest
    // shareable form carries only what differs.
    expect(
      serializeRoute({ page: "holdings", entity: null, query: { q: "luck", sort: "weight" } }),
    ).toBe("#/holdings?q=luck&sort=weight");
  });
});

describe("pnlToday", () => {
  it("backs today's move out of the current market value", () => {
    // +10% on a value of 1100 means 100 of gain.
    expect(pnlToday(holding({ id: "x", marketValue: 1100, dayChangePct: 10 })))
      .toBeCloseTo(100);
  });

  it("is 0 for a flat day", () => {
    expect(pnlToday(holding({ id: "x", marketValue: 1000, dayChangePct: 0 }))).toBe(0);
  });

  it("does not divide by zero at -100%", () => {
    // The `|| 1` guard: a total wipeout would otherwise make the denominator 0.
    const out = pnlToday(holding({ id: "x", marketValue: 1000, dayChangePct: -100 }));
    expect(Number.isFinite(out)).toBe(true);
  });
});

describe("paging holdings", () => {
  it("shows no pager pressure at real portfolio sizes but still slices", () => {
    const out = buildView(rows, HOLDINGS_SPEC, {
      query: "",
      sort: { key: "marketValue", dir: "desc" },
      page: 1,
      pageSize: 2,
    });
    expect(ids(out.rows)).toEqual(["h1", "h3"]);
    expect(out).toMatchObject({ total: 4, pageCount: 2 });
  });
});
