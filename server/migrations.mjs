// Schema for the read-only PSX reference database (data/psx-stocks.db), which
// scripts/fetch-stocks.mjs populates.
//
// This used to be a general versioned migration runner covering the portfolio
// tables too. Those moved to migrations/*.sql, applied by D1 in production and
// by server/local-db.mjs everywhere else — D1 tracks applied migrations itself,
// so the hand-rolled schema_version bookkeeping is gone. What remains here is
// only the reference-database schema, which never reaches D1: the stock list is
// baked to public/psx-stocks.json by scripts/export-stocks-json.mjs and served
// as a static asset.

export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sectors (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS stocks (
      ticker TEXT PRIMARY KEY,
      name   TEXT NOT NULL,
      sector TEXT NOT NULL,
      FOREIGN KEY (sector) REFERENCES sectors(code)
    )
  `);
}
