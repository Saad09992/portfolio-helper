-- Audit trail for the nightly snapshot.
--
-- Added after the cron stopped producing snapshots with no way to find out why:
-- the trigger was registered and firing, the Worker was healthy, and the only
-- evidence was an absence of rows in portfolio_history. Cloudflare's log
-- retention does not cover a once-a-day event you notice days later, so the
-- outcome is now persisted alongside the data it affects.
--
-- One row per invocation, including the ones that decline to snapshot.

CREATE TABLE IF NOT EXISTS cron_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at     TEXT NOT NULL,       -- ISO timestamp of the invocation
  pk_date    TEXT,                -- PKT calendar date it was deciding for
  ran        INTEGER NOT NULL,    -- 1 if a snapshot was written
  reason     TEXT,                -- skip reason, or null on success
  rule       TEXT,                -- freshness rule applied
  quotes     INTEGER,             -- quotes used
  tickers    INTEGER,             -- tickers requested
  sources    TEXT,                -- comma-separated quote sources seen
  kse_source TEXT,                -- which KSE100 source answered
  error      TEXT,                -- exception message, if the run threw
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS cron_runs_ran_at ON cron_runs(ran_at);
