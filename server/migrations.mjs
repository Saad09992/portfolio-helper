// Versioned SQLite migrations. Each migration runs once, in order, inside a
// transaction. Track applied version in `schema_version(version INTEGER)`.
// To add a new migration: append to MIGRATIONS with version = max+1.

const MIGRATIONS = [
  {
    version: 1,
    up(db) {
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
    },
  },
  {
    // Normalized portfolio storage, replacing the flat portfolio.json bundle.
    // Money columns are REAL (rupees) for now; a later migration switches them
    // to INTEGER paisa. Applied to the portfolio DB (separate file from the
    // read-only psx-stocks reference DB).
    version: 2,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS holdings (
          id              TEXT PRIMARY KEY,
          ticker          TEXT NOT NULL,
          name            TEXT NOT NULL DEFAULT '',
          sector          TEXT NOT NULL DEFAULT '',
          account         TEXT NOT NULL DEFAULT '',
          shares          REAL NOT NULL DEFAULT 0,
          price           REAL NOT NULL DEFAULT 0,
          costBasis       REAL NOT NULL DEFAULT 0,
          dayChangePct    REAL NOT NULL DEFAULT 0,
          dividendPerShare REAL NOT NULL DEFAULT 0,
          payoutDate      TEXT NOT NULL DEFAULT '',
          seq             INTEGER
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS payouts (
          holding_id       TEXT NOT NULL,
          seq              INTEGER NOT NULL,
          announcementDate TEXT NOT NULL DEFAULT '',
          bookClosureDate  TEXT NOT NULL DEFAULT '',
          dividendPerShare REAL NOT NULL DEFAULT 0,
          PRIMARY KEY (holding_id, seq),
          FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE CASCADE
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS cash (
          id        INTEGER PRIMARY KEY CHECK (id = 1),
          available REAL NOT NULL DEFAULT 0
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS targets (
          id                TEXT PRIMARY KEY,
          mode              TEXT NOT NULL,
          key               TEXT NOT NULL,
          targetWeight      REAL NOT NULL DEFAULT 0,
          warnThreshold     REAL,
          criticalThreshold REAL,
          cadence           TEXT,
          lastRebalancedAt  TEXT,
          seq               INTEGER
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS investments (
          id       TEXT PRIMARY KEY,
          date     TEXT NOT NULL DEFAULT '',
          label    TEXT NOT NULL DEFAULT '',
          amount   REAL NOT NULL DEFAULT 0,
          valueEom REAL NOT NULL DEFAULT 0,
          seq      INTEGER
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS portfolio_history (
          date        TEXT PRIMARY KEY,
          totalValue  REAL NOT NULL DEFAULT 0,
          totalCost   REAL NOT NULL DEFAULT 0,
          gainLoss    REAL NOT NULL DEFAULT 0,
          kse100      REAL,
          shares_json TEXT
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS meta (
          key   TEXT PRIMARY KEY,
          value TEXT
        )
      `);
    },
  },
  {
    // Per-stock ledger: the transaction log that holdings are now derived from,
    // plus the single editable broker fee / tax rate set. Money columns stay
    // REAL for the same reason as v2 — integers below 2^53 store exactly.
    version: 3,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
          id        TEXT PRIMARY KEY,
          date      TEXT NOT NULL DEFAULT '',
          type      TEXT NOT NULL DEFAULT '',
          ticker    TEXT NOT NULL DEFAULT '',
          name      TEXT NOT NULL DEFAULT '',
          sector    TEXT NOT NULL DEFAULT '',
          shares    REAL NOT NULL DEFAULT 0,
          price     REAL NOT NULL DEFAULT 0,
          amount    REAL NOT NULL DEFAULT 0,
          ratioFrom REAL,
          ratioTo   REAL,
          feeOverride TEXT,
          note      TEXT NOT NULL DEFAULT '',
          seq       INTEGER
        )
      `);
      db.exec(
        "CREATE INDEX IF NOT EXISTS transactions_ticker_date ON transactions(ticker, date)",
      );
      db.exec(`
        CREATE TABLE IF NOT EXISTS fee_config (
          id   INTEGER PRIMARY KEY CHECK (id = 1),
          json TEXT NOT NULL
        )
      `);
    },
  },
];

export function runMigrations(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)",
  );

  const row = db
    .prepare("SELECT MAX(version) AS v FROM schema_version")
    .get();
  const current = row?.v ?? 0;

  const pending = MIGRATIONS.filter((m) => m.version > current).sort(
    (a, b) => a.version - b.version,
  );

  if (pending.length === 0) return current;

  const insertVersion = db.prepare(
    "INSERT INTO schema_version (version) VALUES (?)",
  );

  for (const m of pending) {
    const tx = db.transaction(() => {
      m.up(db);
      insertVersion.run(m.version);
    });
    tx();
    console.log(`[psx] applied migration v${m.version}`);
  }

  return pending[pending.length - 1].version;
}
