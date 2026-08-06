import { describe, expect, it } from "vitest";
import {
  ALL_ROWS,
  buildView,
  columnByKey,
  dateInRange,
  isSortable,
  matchRows,
  nextSort,
  paginate,
  sortRows,
  type SortState,
  type TableSpec,
} from "./tableView";

type Row = { id: string; name: string; qty: number; cash?: boolean };

type Key = "name" | "qty" | "action";

const rows: Row[] = [
  { id: "a", name: "Beta", qty: 30 },
  { id: "b", name: "alpha", qty: 10 },
  { id: "c", name: "Gamma", qty: 20 },
];

const spec: TableSpec<Row, Key> = {
  columns: [
    { key: "name", label: "Name", value: (r) => r.name, defaultDir: "asc" },
    { key: "qty", label: "Qty", value: (r) => r.qty, align: "right" },
    { key: "action", label: "Action" },
  ],
  search: (r) => [r.name, r.id],
};

const ids = (list: readonly Row[]) => list.map((r) => r.id).join("");

const sort = (key: Key | null, dir: "asc" | "desc" = "desc"): SortState<Key> => ({
  key,
  dir,
});

describe("columnByKey / isSortable", () => {
  it("finds a column and reports sortability from the presence of value()", () => {
    expect(columnByKey(spec, "qty")?.label).toBe("Qty");
    expect(isSortable(spec.columns[1])).toBe(true);
    // No value() and no explicit flag — a display-only column.
    expect(isSortable(spec.columns[2])).toBe(false);
  });

  it("lets sortable be forced off for a column that has a value", () => {
    expect(isSortable({ key: "qty", label: "Qty", value: (r: Row) => r.qty, sortable: false }))
      .toBe(false);
  });
});

describe("sortRows", () => {
  it("sorts numbers numerically in both directions", () => {
    expect(ids(sortRows(rows, spec, sort("qty", "asc")))).toBe("bca");
    expect(ids(sortRows(rows, spec, sort("qty", "desc")))).toBe("acb");
  });

  it("sorts strings case-insensitively via localeCompare", () => {
    // "alpha" sorts before "Beta" — a raw < comparison would put it last.
    expect(ids(sortRows(rows, spec, sort("name", "asc")))).toBe("bac");
    expect(ids(sortRows(rows, spec, sort("name", "desc")))).toBe("cab");
  });

  it("preserves input order when there is no sort key", () => {
    expect(ids(sortRows(rows, spec, sort(null)))).toBe("abc");
  });

  it("preserves input order for a display-only column", () => {
    expect(ids(sortRows(rows, spec, sort("action", "asc")))).toBe("abc");
  });

  it("does not mutate the input array", () => {
    const input = [...rows];
    sortRows(input, spec, sort("qty", "asc"));
    expect(ids(input)).toBe("abc");
  });

  it("is stable — equal values keep their relative order", () => {
    const tied: Row[] = [
      { id: "x", name: "x", qty: 5 },
      { id: "y", name: "y", qty: 5 },
      { id: "z", name: "z", qty: 5 },
    ];
    expect(ids(sortRows(tied, spec, sort("qty", "asc")))).toBe("xyz");
    expect(ids(sortRows(tied, spec, sort("qty", "desc")))).toBe("xyz");
  });

  describe("holes (null / undefined / NaN)", () => {
    type Holey = { id: string; price: number | null | undefined };
    const holeySpec: TableSpec<Holey, "price"> = {
      columns: [{ key: "price", label: "Price", value: (r) => r.price }],
    };
    const holey: Holey[] = [
      { id: "a", price: 30 },
      { id: "b", price: null },
      { id: "c", price: 10 },
      { id: "d", price: undefined },
      { id: "e", price: Number.NaN },
    ];

    it("sorts holes last in BOTH directions", () => {
      // A missing price is absent, not small — flipping the arrow must not drag
      // the holes to the top.
      const asc = sortRows(holey, holeySpec, { key: "price", dir: "asc" });
      const desc = sortRows(holey, holeySpec, { key: "price", dir: "desc" });
      expect(asc.slice(0, 2).map((r) => r.id)).toEqual(["c", "a"]);
      expect(desc.slice(0, 2).map((r) => r.id)).toEqual(["a", "c"]);
      for (const out of [asc, desc]) {
        expect(out.slice(2).map((r) => r.id).sort()).toEqual(["b", "d", "e"]);
      }
    });

    it("keeps holes in input order relative to each other", () => {
      const asc = sortRows(holey, holeySpec, { key: "price", dir: "asc" });
      expect(asc.slice(2).map((r) => r.id)).toEqual(["b", "d", "e"]);
    });
  });

  describe("pinLast", () => {
    const pinned: Row[] = [
      { id: "a", name: "Beta", qty: 30 },
      { id: "$", name: "CASH", qty: 999, cash: true },
      { id: "b", name: "alpha", qty: 10 },
      { id: "c", name: "Gamma", qty: 20 },
    ];
    const pinSpec: TableSpec<Row, Key> = { ...spec, pinLast: (r) => r.cash === true };

    it("keeps pinned rows last under every key and both directions", () => {
      for (const key of ["name", "qty"] as const) {
        for (const dir of ["asc", "desc"] as const) {
          const out = sortRows(pinned, pinSpec, sort(key, dir));
          expect(out[out.length - 1].id, `${key}/${dir}`).toBe("$");
        }
      }
    });

    it("does NOT pin when unsorted — the caller's order wins", () => {
      // Holdings puts the synthetic cash row FIRST in its own order, and pinning
      // it while unsorted would silently undo that.
      expect(ids(sortRows(pinned, pinSpec, sort(null)))).toBe("a$bc");
    });

    it("does not pin for a display-only column either", () => {
      expect(ids(sortRows(pinned, pinSpec, sort("action", "asc")))).toBe("a$bc");
    });

    it("sorts the unpinned rows normally around the pin", () => {
      expect(ids(sortRows(pinned, pinSpec, sort("qty", "asc")))).toBe("bca$");
    });
  });
});

describe("matchRows", () => {
  it("passes everything through for an empty or whitespace query", () => {
    for (const q of ["", "   "]) {
      expect(ids(matchRows(rows, spec, q))).toBe("abc");
    }
  });

  it("matches a case-insensitive substring across any search field", () => {
    expect(ids(matchRows(rows, spec, "ALPH"))).toBe("b");
    expect(ids(matchRows(rows, spec, "mm"))).toBe("c");
    // `id` is a search field too.
    expect(ids(matchRows(rows, spec, "a"))).toBe("abc");
  });

  it("trims the query before matching", () => {
    expect(ids(matchRows(rows, spec, "  gamma  "))).toBe("c");
  });

  it("returns nothing when there is no match", () => {
    expect(matchRows(rows, spec, "zzz")).toEqual([]);
  });

  it("tolerates null and undefined search fields", () => {
    const holey: TableSpec<Row, Key> = {
      ...spec,
      search: (r) => [null, undefined, r.name],
    };
    expect(ids(matchRows(rows, holey, "beta"))).toBe("a");
  });

  it("ANDs the predicates together and applies them without a query", () => {
    const filtered: TableSpec<Row, Key> = {
      ...spec,
      predicates: [(r) => r.qty >= 20, (r) => r.name !== "Gamma"],
    };
    expect(ids(matchRows(rows, filtered, ""))).toBe("a");
  });

  it("combines predicates with the query", () => {
    const filtered: TableSpec<Row, Key> = { ...spec, predicates: [(r) => r.qty >= 20] };
    expect(ids(matchRows(rows, filtered, "gamma"))).toBe("c");
    expect(matchRows(rows, filtered, "alpha")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [...rows];
    matchRows(input, spec, "alpha");
    expect(ids(input)).toBe("abc");
  });
});

describe("paginate", () => {
  const ten = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: "", qty: i }));

  it("slices the first page and reports 1-based bounds", () => {
    const out = paginate(ten, 1, 4);
    expect(out.rows).toHaveLength(4);
    expect(out).toMatchObject({ page: 1, pageCount: 3, from: 1, to: 4, total: 10 });
  });

  it("slices a middle page", () => {
    expect(paginate(ten, 2, 4)).toMatchObject({ page: 2, from: 5, to: 8 });
  });

  it("handles a short final page", () => {
    const out = paginate(ten, 3, 4);
    expect(out.rows).toHaveLength(2);
    expect(out).toMatchObject({ page: 3, pageCount: 3, from: 9, to: 10 });
  });

  it("clamps a page past the end down to the last page", () => {
    // The stale-shared-link case: ?page=9 against a 3-page result.
    expect(paginate(ten, 9, 4)).toMatchObject({ page: 3, from: 9, to: 10 });
  });

  it("clamps a zero, negative or fractional page up to 1", () => {
    for (const page of [0, -5, Number.NaN, 0.4]) {
      expect(paginate(ten, page, 4).page, String(page)).toBe(1);
    }
  });

  it("treats an empty result as one empty page", () => {
    expect(paginate([], 1, 4)).toMatchObject({
      rows: [],
      page: 1,
      pageCount: 1,
      from: 0,
      to: 0,
      total: 0,
    });
  });

  it("returns everything as a single page for ALL_ROWS", () => {
    const out = paginate(ten, 3, ALL_ROWS);
    expect(out.rows).toHaveLength(10);
    expect(out).toMatchObject({ page: 1, pageCount: 1, from: 1, to: 10, total: 10 });
  });

  it("reports from: 0 for ALL_ROWS over an empty result", () => {
    expect(paginate([], 1, ALL_ROWS)).toMatchObject({ from: 0, to: 0, pageCount: 1 });
  });

  it("treats a nonsense page size as ALL_ROWS rather than dividing by zero", () => {
    expect(paginate(ten, 1, 0).rows).toHaveLength(10);
  });

  it("reports the exact page count when the total divides evenly", () => {
    expect(paginate(ten, 1, 5).pageCount).toBe(2);
    expect(paginate(ten, 1, 10).pageCount).toBe(1);
  });
});

describe("nextSort", () => {
  it("starts a new column at its defaultDir", () => {
    expect(nextSort(sort(null), "name", "asc")).toEqual({ key: "name", dir: "asc" });
    expect(nextSort(sort(null), "qty", "desc")).toEqual({ key: "qty", dir: "desc" });
  });

  it("switches columns at the new column's defaultDir, ignoring the old dir", () => {
    expect(nextSort(sort("qty", "asc"), "name", "asc")).toEqual({ key: "name", dir: "asc" });
  });

  it("defaults to desc-first — the cycle Holdings already had", () => {
    // Three clicks on one header: desc -> asc -> unsorted.
    let state = sort(null);
    state = nextSort(state, "qty");
    expect(state).toEqual({ key: "qty", dir: "desc" });
    state = nextSort(state, "qty");
    expect(state).toEqual({ key: "qty", dir: "asc" });
    state = nextSort(state, "qty");
    expect(state.key).toBeNull();
  });

  it("cycles asc-first for a text column, still off on the third click", () => {
    let state = sort(null);
    state = nextSort(state, "name", "asc");
    expect(state).toEqual({ key: "name", dir: "asc" });
    state = nextSort(state, "name", "asc");
    expect(state).toEqual({ key: "name", dir: "desc" });
    state = nextSort(state, "name", "asc");
    expect(state.key).toBeNull();
  });

  it("never reaches unsorted when allowUnsorted is false", () => {
    // Targets: its default drift sort is load-bearing, so "unsorted" there just
    // means "arbitrary order".
    let state = sort(null);
    state = nextSort(state, "qty", "desc", false);
    expect(state).toEqual({ key: "qty", dir: "desc" });
    state = nextSort(state, "qty", "desc", false);
    expect(state).toEqual({ key: "qty", dir: "asc" });
    state = nextSort(state, "qty", "desc", false);
    expect(state).toEqual({ key: "qty", dir: "desc" });
    // ...and it keeps flipping rather than ever going null.
    for (let i = 0; i < 5; i++) {
      state = nextSort(state, "qty", "desc", false);
      expect(state.key).toBe("qty");
    }
  });

  it("returns to the start after three clicks, whatever the defaultDir", () => {
    for (const dir of ["asc", "desc"] as const) {
      let state = sort(null);
      for (let i = 0; i < 3; i++) state = nextSort(state, "qty", dir);
      expect(state.key, dir).toBeNull();
    }
  });
});

describe("buildView", () => {
  it("filters, then sorts, then slices — in that order", () => {
    const many: Row[] = [
      { id: "a", name: "Oil A", qty: 5 },
      { id: "b", name: "Gas B", qty: 90 },
      { id: "c", name: "Oil C", qty: 30 },
      { id: "d", name: "Oil D", qty: 10 },
    ];
    const out = buildView(many, spec, {
      query: "oil",
      sort: sort("qty", "desc"),
      page: 1,
      pageSize: 2,
    });
    // "Gas B" is filtered out before sorting, so the biggest qty on page 1 is 30
    // rather than 90 — that is the whole point of the ordering.
    expect(ids(out.rows)).toBe("cd");
    expect(out).toMatchObject({ total: 3, pageCount: 2, from: 1, to: 2 });
  });

  it("reports total as the filtered count, not the input size", () => {
    const out = buildView(rows, spec, {
      query: "alpha",
      sort: sort(null),
      page: 1,
      pageSize: 50,
    });
    expect(out.total).toBe(1);
  });

  it("pages through a filtered set without losing or repeating a row", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      id: String(i),
      name: `row ${i}`,
      qty: i,
    }));
    const seen: string[] = [];
    for (let page = 1; page <= 3; page++) {
      seen.push(...buildView(many, spec, {
        query: "",
        sort: sort("qty", "asc"),
        page,
        pageSize: 3,
      }).rows.map((r) => r.id));
    }
    expect(seen).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
  });

  it("clamps a stale page after a filter narrows the result", () => {
    // Was on page 3 of an unfiltered list; the filter leaves one page.
    const out = buildView(rows, spec, {
      query: "alpha",
      sort: sort(null),
      page: 3,
      pageSize: 2,
    });
    expect(out).toMatchObject({ page: 1, pageCount: 1, total: 1 });
    expect(ids(out.rows)).toBe("b");
  });
});

describe("dateInRange", () => {
  it("is inclusive at both ends", () => {
    expect(dateInRange("2026-01-01", "2026-01-01", "2026-01-31")).toBe(true);
    expect(dateInRange("2026-01-31", "2026-01-01", "2026-01-31")).toBe(true);
  });

  it("excludes dates outside the range", () => {
    expect(dateInRange("2025-12-31", "2026-01-01", "2026-01-31")).toBe(false);
    expect(dateInRange("2026-02-01", "2026-01-01", "2026-01-31")).toBe(false);
  });

  it("treats an absent bound as unbounded", () => {
    expect(dateInRange("1999-01-01", undefined, "2026-01-31")).toBe(true);
    expect(dateInRange("2099-01-01", "2026-01-01", undefined)).toBe(true);
    expect(dateInRange("2026-06-15")).toBe(true);
  });

  it("treats an empty-string bound as absent", () => {
    // Absent and empty mean the same thing everywhere else (see routes.ts).
    expect(dateInRange("1999-01-01", "", "")).toBe(true);
  });

  it("compares lexically, so an inverted range matches nothing", () => {
    expect(dateInRange("2026-01-15", "2026-01-31", "2026-01-01")).toBe(false);
  });
});
