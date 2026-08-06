-- Per-IP login throttle for the cookie session gate (worker/auth.mjs).
--
-- Rows are transient: a successful login deletes the caller's row, and stale
-- rows age out of relevance once their window expires. There is no cleanup job
-- because a single-user app cannot accumulate meaningfully many rows.

CREATE TABLE IF NOT EXISTS login_attempts (
  ip           TEXT PRIMARY KEY,
  failures     INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  locked_until INTEGER
);
