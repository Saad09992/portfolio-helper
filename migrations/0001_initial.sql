-- Initial portfolio schema for D1.
--
-- Collapses what were versions 2 and 3 of the old hand-rolled migration runner
-- (server/migrations.mjs) into a single migration, since D1 starts empty and
-- there is no intermediate state to step through. Version 1 of the old runner
-- created `sectors` and `stocks` in the portfolio database, but nothing ever
-- read them there -- the real stock list lives in the separate read-only
-- psx-stocks.db, which is now baked to static JSON. Those two tables are
-- deliberately not recreated here.
--
-- Money columns are REAL, matching the existing database. Values are integer
-- paisa, which is exact in a double below 2^53.

CREATE TABLE IF NOT EXISTS holdings (
  id               TEXT PRIMARY KEY,
  ticker           TEXT NOT NULL,
  name             TEXT NOT NULL DEFAULT '',
  sector           TEXT NOT NULL DEFAULT '',
  account          TEXT NOT NULL DEFAULT '',
  shares           REAL NOT NULL DEFAULT 0,
  price            REAL NOT NULL DEFAULT 0,
  costBasis        REAL NOT NULL DEFAULT 0,
  dayChangePct     REAL NOT NULL DEFAULT 0,
  dividendPerShare REAL NOT NULL DEFAULT 0,
  payoutDate       TEXT NOT NULL DEFAULT '',
  seq              INTEGER
);

CREATE TABLE IF NOT EXISTS payouts (
  holding_id       TEXT NOT NULL,
  seq              INTEGER NOT NULL,
  announcementDate TEXT NOT NULL DEFAULT '',
  bookClosureDate  TEXT NOT NULL DEFAULT '',
  dividendPerShare REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (holding_id, seq),
  FOREIGN KEY (holding_id) REFERENCES holdings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cash (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  available REAL NOT NULL DEFAULT 0
);

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
);

CREATE TABLE IF NOT EXISTS investments (
  id       TEXT PRIMARY KEY,
  date     TEXT NOT NULL DEFAULT '',
  label    TEXT NOT NULL DEFAULT '',
  amount   REAL NOT NULL DEFAULT 0,
  valueEom REAL NOT NULL DEFAULT 0,
  seq      INTEGER
);

CREATE TABLE IF NOT EXISTS portfolio_history (
  date        TEXT PRIMARY KEY,
  totalValue  REAL NOT NULL DEFAULT 0,
  totalCost   REAL NOT NULL DEFAULT 0,
  gainLoss    REAL NOT NULL DEFAULT 0,
  kse100      REAL,
  shares_json TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  date        TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT '',
  ticker      TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL DEFAULT '',
  sector      TEXT NOT NULL DEFAULT '',
  shares      REAL NOT NULL DEFAULT 0,
  price       REAL NOT NULL DEFAULT 0,
  amount      REAL NOT NULL DEFAULT 0,
  ratioFrom   REAL,
  ratioTo     REAL,
  feeOverride TEXT,
  note        TEXT NOT NULL DEFAULT '',
  seq         INTEGER
);

CREATE INDEX IF NOT EXISTS transactions_ticker_date ON transactions(ticker, date);

CREATE TABLE IF NOT EXISTS fee_config (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT NOT NULL
);
