// Thin async SQL adapter so the portfolio storage layer can run against either
// D1 (production, on Workers) or better-sqlite3 (tests and any Node host).
//
// Both backends speak SQLite, so the SQL itself is shared verbatim. What differs
// is the calling convention: D1 is async and positional-only, better-sqlite3 is
// synchronous. This normalizes to the async/positional shape — the narrower of
// the two — so a query written against the adapter runs unchanged on both.
//
// Interface:
//   first(sql, params) -> row | null
//   all(sql, params)   -> row[]
//   run(sql, params)   -> void
//   batch(statements)  -> void      // atomic; statements are {sql, params}

/** D1 backend. `d1` is the binding from `env.DB`. */
export function d1Adapter(d1) {
  const prep = (sql, params) => {
    const stmt = d1.prepare(sql);
    // D1 rejects .bind() with no arguments on some versions; skip when empty.
    return params && params.length ? stmt.bind(...params) : stmt;
  };

  return {
    kind: "d1",

    async first(sql, params = []) {
      return (await prep(sql, params).first()) ?? null;
    },

    async all(sql, params = []) {
      const { results } = await prep(sql, params).all();
      return results ?? [];
    },

    async run(sql, params = []) {
      await prep(sql, params).run();
    },

    // D1 applies a batch as a single implicit transaction and rolls the whole
    // thing back if any statement fails.
    async batch(statements) {
      if (!statements.length) return;
      await d1.batch(statements.map(({ sql, params }) => prep(sql, params ?? [])));
    },
  };
}

/** better-sqlite3 backend. `db` is an open Database instance. */
export function sqliteAdapter(db) {
  return {
    kind: "sqlite",

    async first(sql, params = []) {
      return db.prepare(sql).get(...params) ?? null;
    },

    async all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },

    async run(sql, params = []) {
      db.prepare(sql).run(...params);
    },

    // Mirrors D1's all-or-nothing semantics with a real transaction, so a
    // partial write can't survive on one backend but not the other.
    async batch(statements) {
      if (!statements.length) return;
      const tx = db.transaction(() => {
        for (const { sql, params } of statements) {
          db.prepare(sql).run(...(params ?? []));
        }
      });
      tx();
    },
  };
}
