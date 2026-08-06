import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUTE,
  holdingsQueryHref,
  pageHref,
  parseHash,
  serializeRoute,
  stockHref,
  taxHref,
  type Route,
} from "./routes";

const route = (o: Partial<Route> = {}): Route => ({
  page: "overview",
  entity: null,
  query: {},
  ...o,
});

describe("parseHash", () => {
  it("falls back to overview for empty and legacy hashes", () => {
    for (const hash of ["", "#", "#/", "/"]) {
      expect(parseHash(hash)).toEqual(DEFAULT_ROUTE);
    }
  });

  it("parses a bare page", () => {
    expect(parseHash("#/holdings")).toEqual(route({ page: "holdings" }));
  });

  it("drops the entity when the page is unknown", () => {
    // A stale link must not leave an entity attached to the wrong page.
    expect(parseHash("#/nope/ENGRO")).toEqual(DEFAULT_ROUTE);
  });

  it("keeps query params when the page is unknown", () => {
    expect(parseHash("#/nope?range=ytd")).toEqual(route({ query: { range: "ytd" } }));
  });

  it("upper-cases a ticker entity", () => {
    expect(parseHash("#/stocks/engro")).toEqual(
      route({ page: "stocks", entity: "ENGRO" }),
    );
  });

  it("leaves a fiscal-year entity untouched", () => {
    expect(parseHash("#/tax/2025-26")).toEqual(
      route({ page: "tax", entity: "2025-26" }),
    );
  });

  it("parses query params", () => {
    expect(parseHash("#/overview?range=ytd&tmap=ticker")).toEqual(
      route({ query: { range: "ytd", tmap: "ticker" } }),
    );
  });

  it("treats an empty param value as absent", () => {
    expect(parseHash("#/overview?range=&tmap=ticker")).toEqual(
      route({ query: { tmap: "ticker" } }),
    );
  });

  it("tolerates junk without throwing", () => {
    expect(parseHash("#/overview?&&=&x")).toEqual(route());
    // A malformed percent escape must not throw out of decodeURIComponent.
    expect(parseHash("#/holdings?q=%zz")).toEqual(
      route({ page: "holdings", query: { q: "%zz" } }),
    );
  });

  it("ignores extra path segments", () => {
    expect(parseHash("#/stocks/ENGRO/extra")).toEqual(
      route({ page: "stocks", entity: "ENGRO" }),
    );
  });

  it("lower-cases the page segment", () => {
    expect(parseHash("#/Holdings")).toEqual(route({ page: "holdings" }));
  });
});

describe("serializeRoute", () => {
  it("omits the query when empty", () => {
    expect(serializeRoute(route({ page: "stocks", entity: "ENGRO" }))).toBe(
      "#/stocks/ENGRO",
    );
  });

  it("sorts keys so the same view always serializes identically", () => {
    const a = serializeRoute(route({ query: { tmap: "ticker", range: "ytd" } }));
    const b = serializeRoute(route({ query: { range: "ytd", tmap: "ticker" } }));
    expect(a).toBe(b);
    expect(a).toBe("#/overview?range=ytd&tmap=ticker");
  });

  it("drops empty values", () => {
    expect(serializeRoute(route({ query: { range: "", tmap: "ticker" } }))).toBe(
      "#/overview?tmap=ticker",
    );
  });

  it("encodes # and & so they cannot truncate or split the hash", () => {
    const hash = serializeRoute(route({ page: "holdings", query: { q: "a#b&c=d" } }));
    expect(hash).toBe("#/holdings?q=a%23b%26c%3Dd");
    expect(parseHash(hash).query.q).toBe("a#b&c=d");
  });

  it("encodes an entity with a slash", () => {
    const hash = serializeRoute(route({ page: "tax", entity: "a/b" }));
    expect(parseHash(hash).entity).toBe("a/b");
  });
});

describe("round trip", () => {
  const cases: Route[] = [
    route(),
    route({ page: "holdings", query: { q: "luck", sort: "weight", dir: "desc" } }),
    route({ page: "stocks", entity: "ENGRO" }),
    route({ page: "tax", entity: "2025-26" }),
    route({ page: "overview", query: { range: "ytd", tmap: "ticker", alloc: "ranked" } }),
    route({ page: "holdings", query: { q: "oil & gas" } }),
  ];

  it.each(cases)("parseHash(serializeRoute(r)) === r for %j", (r) => {
    expect(parseHash(serializeRoute(r))).toEqual(r);
  });
});

describe("href helpers", () => {
  it("builds page hrefs", () => {
    expect(pageHref("ledger")).toBe("#/ledger");
  });

  it("upper-cases tickers", () => {
    expect(stockHref("engro")).toBe("#/stocks/ENGRO");
  });

  it("builds tax and holdings-filter hrefs", () => {
    expect(taxHref("2025-26")).toBe("#/tax/2025-26");
    expect(holdingsQueryHref("Materials")).toBe("#/holdings?q=Materials");
  });
});

describe("serialization is canonical", () => {
  it("is stable across query key order, so the same view shares one URL", () => {
    expect(serializeRoute(route({ query: { a: "1", b: "2" } }))).toBe(
      serializeRoute(route({ query: { b: "2", a: "1" } })),
    );
  });

  it("distinguishes entities", () => {
    expect(serializeRoute(route({ page: "stocks", entity: "A" }))).not.toBe(
      serializeRoute(route({ page: "stocks", entity: "B" })),
    );
  });
});
