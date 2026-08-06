// The URL contract, both directions.
//
// Vitest runs in node with no jsdom, so the hook itself can't be rendered. These
// are the pure param decisions it makes, wired through the real `parseHash` /
// `serializeRoute` so the round trip is checked against the actual router rather
// than an assumption about it.

import { describe, expect, it } from "vitest";
import { TABLE } from "../constants";
import { parseHash, serializeRoute } from "../routes";
import { ALL_ROWS } from "../table/tableView";
import {
  pageParam,
  pageSizeParam,
  paramKey,
  parsePageSize,
  sortParams,
} from "./useTableView";

describe("paramKey", () => {
  it("leaves keys bare for the primary table", () => {
    // Holdings depends on this: `#/holdings?q=…&sort=…&dir=…` is documented in
    // routes.ts and produced by holdingsQueryHref.
    expect(paramKey("", "q")).toBe("q");
    expect(paramKey("", "sort")).toBe("sort");
    expect(paramKey("", "dir")).toBe("dir");
  });

  it("prefixes secondary tables so two on a page can't collide", () => {
    expect(paramKey("l", "q")).toBe("lq");
    expect(paramKey("tx", "sort")).toBe("txsort");
    expect(paramKey("dv", "page")).toBe("dvpage");
  });

  it("gives every namespace a distinct key for the same field", () => {
    const namespaces = ["", "l", "s", "tx", "dv"];
    for (const field of ["q", "sort", "dir", "page", "size"]) {
      const keys = namespaces.map((ns) => paramKey(ns, field));
      expect(new Set(keys).size, field).toBe(keys.length);
    }
  });
});

describe("sortParams", () => {
  it("omits dir for descending, the default", () => {
    expect(sortParams({ key: "weight", dir: "desc" })).toEqual({
      sort: "weight",
      dir: null,
    });
  });

  it("writes dir only when ascending", () => {
    expect(sortParams({ key: "weight", dir: "asc" })).toEqual({
      sort: "weight",
      dir: "asc",
    });
  });

  it("clears both when unsorted", () => {
    expect(sortParams({ key: null, dir: "asc" })).toEqual({ sort: null, dir: null });
  });
});

describe("pageParam", () => {
  it("omits page 1 so the first page never shows in the URL", () => {
    expect(pageParam(1)).toBeNull();
    expect(pageParam(0)).toBeNull();
  });

  it("writes any later page", () => {
    expect(pageParam(3)).toBe("3");
  });
});

describe("pageSizeParam / parsePageSize", () => {
  const dflt = TABLE.DEFAULT_PAGE_SIZE;

  it("omits the default size", () => {
    expect(pageSizeParam(dflt, dflt)).toBeNull();
  });

  it("writes 'all' for no paging", () => {
    expect(pageSizeParam(ALL_ROWS, dflt)).toBe("all");
  });

  it("round-trips every offered size", () => {
    for (const size of TABLE.PAGE_SIZES) {
      const param = pageSizeParam(size, dflt);
      expect(parsePageSize(param ?? undefined, dflt, TABLE.PAGE_SIZES), String(size))
        .toBe(size);
    }
  });

  it("falls back to the default for junk rather than throwing", () => {
    for (const raw of [undefined, "", "abc", "-5", "99999", "0"]) {
      expect(parsePageSize(raw, dflt, TABLE.PAGE_SIZES), String(raw)).toBe(dflt);
    }
  });
});

describe("round trip through the real router", () => {
  /** What the hook writes, applied the way `setParam` applies it. */
  const write = (
    base: Record<string, string>,
    writes: Record<string, string | null>,
  ) => {
    const query = { ...base };
    for (const [k, v] of Object.entries(writes)) {
      if (v === null || v === "") delete query[k];
      else query[k] = v;
    }
    return query;
  };

  it("produces the documented Holdings URL", () => {
    const sort = sortParams({ key: "weight", dir: "desc" as const });
    const query = write({ q: "luck" }, { sort: sort.sort, dir: sort.dir, page: null });
    const hash = serializeRoute({ page: "holdings", entity: null, query });
    expect(hash).toBe("#/holdings?q=luck&sort=weight");
    // And it reads back to the same state.
    expect(parseHash(hash).query).toEqual({ q: "luck", sort: "weight" });
  });

  it("adds dir=asc on the second click and drops both on the third", () => {
    let query = write({ q: "luck" }, { ...spread(sortParams({ key: "weight", dir: "desc" })) });
    expect(serializeRoute({ page: "holdings", entity: null, query })).toBe(
      "#/holdings?q=luck&sort=weight",
    );

    query = write(query, spread(sortParams({ key: "weight", dir: "asc" })));
    expect(serializeRoute({ page: "holdings", entity: null, query })).toBe(
      "#/holdings?dir=asc&q=luck&sort=weight",
    );

    query = write(query, spread(sortParams({ key: null, dir: "desc" })));
    expect(serializeRoute({ page: "holdings", entity: null, query })).toBe(
      "#/holdings?q=luck",
    );
  });

  it("namespaces the ledger without touching a Holdings param", () => {
    const query = write(
      {},
      {
        [paramKey("l", "q")]: "ogdc",
        [paramKey("l", "sort")]: "value",
        [paramKey("l", "page")]: pageParam(3),
        [paramKey("l", "type")]: "SELL",
      },
    );
    const hash = serializeRoute({ page: "ledger", entity: null, query });
    expect(hash).toBe("#/ledger?lpage=3&lq=ogdc&lsort=value&ltype=SELL");
    // No bare q/sort/dir anywhere in it.
    const parsed = parseHash(hash).query;
    expect(parsed.q).toBeUndefined();
    expect(parsed.sort).toBeUndefined();
    expect(parsed.dir).toBeUndefined();
  });

  it("keeps two tables on the Tax page independent", () => {
    const query = write(
      {},
      {
        [paramKey("tx", "sort")]: "gain",
        [paramKey("tx", "page")]: pageParam(2),
        [paramKey("dv", "sort")]: "net",
      },
    );
    const parsed = parseHash(
      serializeRoute({ page: "tax", entity: "2025-26", query }),
    );
    expect(parsed.query.txsort).toBe("gain");
    expect(parsed.query.txpage).toBe("2");
    expect(parsed.query.dvsort).toBe("net");
    expect(parsed.entity).toBe("2025-26");
  });

  it("survives a search string with URL-hostile characters", () => {
    // An unescaped '#' or '&' from the search box would truncate the hash.
    const q = "Oil & Gas #1 50%";
    const hash = serializeRoute({ page: "holdings", entity: null, query: { q } });
    expect(parseHash(hash).query.q).toBe(q);
  });
});

/** `sortParams` returns named fields; the URL wants them keyed by param name. */
function spread(p: { sort: string | null; dir: string | null }) {
  return { sort: p.sort, dir: p.dir, page: null };
}
