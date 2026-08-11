// Normalized SQLite storage for the portfolio bundle. Presents the exact same
// bundle shape the client's /api/portfolio/load|save contract expects, so the
// frontend is unchanged — only the storage backend moved off flat JSON.
//
// Runs against either D1 or better-sqlite3 through server/db-adapter.mjs. All
// entry points are async and all parameters are positional, because that is
// what D1 supports — better-sqlite3 tolerates the same shape.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v) => (v == null ? "" : String(v));

async function getMeta(db, key) {
  const row = await db.first("SELECT value FROM meta WHERE key = ?", [key]);
  return row ? row.value : null;
}

/**
 * The current bundle version, used for optimistic concurrency on save.
 *
 * `savedAt` doubles as the version token: every write sets it, so a client that
 * still holds an older value is by definition working from a stale bundle.
 */
export async function currentVersion(db) {
  return getMeta(db, "savedAt");
}

// Assemble the bundle from the normalized tables. Returns null when nothing has
// ever been saved (no savedAt sentinel) so the client falls back to its seed,
// matching the old "portfolio.json missing → null" behavior.
export async function loadBundle(db) {
  const savedAt = await getMeta(db, "savedAt");
  if (savedAt == null) return null;

  const payoutRows = await db.all(
    "SELECT * FROM payouts ORDER BY holding_id, seq",
  );
  const payoutsByHolding = new Map();
  for (const p of payoutRows) {
    const list = payoutsByHolding.get(p.holding_id) ?? [];
    list.push({
      announcementDate: p.announcementDate,
      bookClosureDate: p.bookClosureDate,
      dividendPerShare: p.dividendPerShare,
    });
    payoutsByHolding.set(p.holding_id, list);
  }

  const holdingRows = await db.all("SELECT * FROM holdings ORDER BY seq");
  const holdings = holdingRows.map((h) => {
    const holding = {
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      sector: h.sector,
      account: h.account,
      shares: h.shares,
      price: h.price,
      costBasis: h.costBasis,
      dayChangePct: h.dayChangePct,
      dividendPerShare: h.dividendPerShare,
      payoutDate: h.payoutDate,
    };
    const payouts = payoutsByHolding.get(h.id);
    if (payouts) holding.payouts = payouts;
    return holding;
  });

  const cashRow = await db.first("SELECT available FROM cash WHERE id = 1");
  const cash = { available: cashRow ? cashRow.available : 0 };

  const targetRows = await db.all("SELECT * FROM targets ORDER BY seq");
  const targets = targetRows.map((t) => {
    const target = {
      id: t.id,
      mode: t.mode,
      key: t.key,
      targetWeight: t.targetWeight,
    };
    if (t.warnThreshold != null) target.warnThreshold = t.warnThreshold;
    if (t.criticalThreshold != null) target.criticalThreshold = t.criticalThreshold;
    if (t.cadence != null) target.cadence = t.cadence;
    target.lastRebalancedAt = t.lastRebalancedAt ?? null;
    return target;
  });

  const investmentRows = await db.all("SELECT * FROM investments ORDER BY seq");
  const investments = investmentRows.map((i) => ({
    id: i.id,
    date: i.date,
    label: i.label,
    amount: i.amount,
    valueEom: i.valueEom,
  }));

  const txnRows = await db.all("SELECT * FROM transactions ORDER BY seq");
  const transactions = txnRows.map((t) => {
    const txn = {
      id: t.id,
      date: t.date,
      type: t.type,
      ticker: t.ticker,
      name: t.name,
      sector: t.sector,
      shares: t.shares,
      price: t.price,
      amount: t.amount,
      note: t.note,
    };
    if (t.ratioFrom != null) txn.ratioFrom = t.ratioFrom;
    if (t.ratioTo != null) txn.ratioTo = t.ratioTo;
    if (t.feeOverride) {
      try {
        txn.feeOverride = JSON.parse(t.feeOverride);
      } catch {
        /* ignore malformed */
      }
    }
    return txn;
  });

  const feeRow = await db.first("SELECT json FROM fee_config WHERE id = 1");
  let feeConfig = null;
  if (feeRow?.json) {
    try {
      feeConfig = JSON.parse(feeRow.json);
    } catch {
      /* ignore malformed — client falls back to defaults */
    }
  }

  const historyRows = await db.all(
    "SELECT * FROM portfolio_history ORDER BY date",
  );
  const history = historyRows.map((row) => {
    const entry = {
      date: row.date,
      totalValue: row.totalValue,
      totalCost: row.totalCost,
      gainLoss: row.gainLoss,
    };
    if (row.shares_json) {
      try {
        entry.shares = JSON.parse(row.shares_json);
      } catch {
        /* ignore malformed */
      }
    }
    if (row.kse100 != null) entry.kse100 = row.kse100;
    return entry;
  });

  return {
    holdings,
    cash,
    targets,
    investments,
    transactions,
    feeConfig,
    history,
    lastFetchedAt: await getMeta(db, "lastFetchedAt"),
    savedAt,
  };
}

// SQL is kept next to its binder so the positional argument order can be checked
// against the column list at a glance. D1 has no named parameters, so a
// mis-ordered array here would corrupt data silently rather than throw —
// portfolio-db.test.mjs round-trips every table for exactly this reason.
const INSERT_HOLDING = `INSERT INTO holdings
  (id, ticker, name, sector, account, shares, price, costBasis, dayChangePct, dividendPerShare, payoutDate, seq)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const INSERT_PAYOUT = `INSERT INTO payouts
  (holding_id, seq, announcementDate, bookClosureDate, dividendPerShare)
  VALUES (?, ?, ?, ?, ?)`;

const INSERT_TARGET = `INSERT INTO targets
  (id, mode, key, targetWeight, warnThreshold, criticalThreshold, cadence, lastRebalancedAt, seq)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const INSERT_INVESTMENT = `INSERT INTO investments
  (id, date, label, amount, valueEom, seq)
  VALUES (?, ?, ?, ?, ?, ?)`;

const INSERT_TXN = `INSERT INTO transactions
  (id, date, type, ticker, name, sector, shares, price, amount, ratioFrom, ratioTo, feeOverride, note, seq)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const INSERT_HISTORY = `INSERT INTO portfolio_history
  (date, totalValue, totalCost, gainLoss, kse100, shares_json)
  VALUES (?, ?, ?, ?, ?, ?)`;

// Payouts before holdings: the FK is ON DELETE CASCADE, but ordering the
// deletes explicitly keeps the intent readable and backend-independent.
const CLEAR_TABLES = [
  "DELETE FROM payouts",
  "DELETE FROM holdings",
  "DELETE FROM cash",
  "DELETE FROM targets",
  "DELETE FROM investments",
  "DELETE FROM transactions",
  "DELETE FROM fee_config",
  "DELETE FROM portfolio_history",
  "DELETE FROM meta",
];

// Disassemble the bundle into the normalized tables inside a single atomic
// batch. Full-replace semantics match the whole-bundle contract.
export async function saveBundle(db, bundle) {
  const b = typeof bundle === "string" ? JSON.parse(bundle) : bundle;

  const holdings = Array.isArray(b.holdings) ? b.holdings : [];
  const targets = Array.isArray(b.targets) ? b.targets : [];
  const investments = Array.isArray(b.investments) ? b.investments : [];
  const transactions = Array.isArray(b.transactions) ? b.transactions : [];
  const feeConfig =
    b.feeConfig && typeof b.feeConfig === "object" ? b.feeConfig : null;
  const history = Array.isArray(b.history) ? b.history : [];
  const cashAvailable = num(b.cash && b.cash.available);
  const lastFetchedAt = b.lastFetchedAt == null ? null : String(b.lastFetchedAt);
  const savedAt = b.savedAt == null ? new Date().toISOString() : String(b.savedAt);

  const statements = CLEAR_TABLES.map((sql) => ({ sql, params: [] }));

  holdings.forEach((h, i) => {
    statements.push({
      sql: INSERT_HOLDING,
      params: [
        str(h.id),
        str(h.ticker),
        str(h.name),
        str(h.sector),
        str(h.account),
        num(h.shares),
        num(h.price),
        num(h.costBasis),
        num(h.dayChangePct),
        num(h.dividendPerShare),
        str(h.payoutDate),
        i,
      ],
    });
    if (Array.isArray(h.payouts)) {
      h.payouts.forEach((p, j) => {
        statements.push({
          sql: INSERT_PAYOUT,
          params: [
            str(h.id),
            j,
            str(p.announcementDate),
            str(p.bookClosureDate),
            num(p.dividendPerShare),
          ],
        });
      });
    }
  });

  statements.push({
    sql: "INSERT INTO cash (id, available) VALUES (1, ?)",
    params: [cashAvailable],
  });

  targets.forEach((t, i) => {
    statements.push({
      sql: INSERT_TARGET,
      params: [
        str(t.id),
        str(t.mode),
        str(t.key),
        num(t.targetWeight),
        t.warnThreshold == null ? null : num(t.warnThreshold),
        t.criticalThreshold == null ? null : num(t.criticalThreshold),
        t.cadence == null ? null : String(t.cadence),
        t.lastRebalancedAt == null ? null : String(t.lastRebalancedAt),
        i,
      ],
    });
  });

  investments.forEach((iv, i) => {
    statements.push({
      sql: INSERT_INVESTMENT,
      params: [
        str(iv.id),
        str(iv.date),
        str(iv.label),
        num(iv.amount),
        num(iv.valueEom),
        i,
      ],
    });
  });

  transactions.forEach((t, i) => {
    statements.push({
      sql: INSERT_TXN,
      params: [
        str(t.id),
        str(t.date),
        str(t.type),
        str(t.ticker).toUpperCase(),
        str(t.name),
        str(t.sector),
        num(t.shares),
        num(t.price),
        num(t.amount),
        t.ratioFrom == null ? null : num(t.ratioFrom),
        t.ratioTo == null ? null : num(t.ratioTo),
        t.feeOverride && typeof t.feeOverride === "object"
          ? JSON.stringify(t.feeOverride)
          : null,
        str(t.note),
        i,
      ],
    });
  });

  if (feeConfig) {
    statements.push({
      sql: "INSERT INTO fee_config (id, json) VALUES (1, ?)",
      params: [JSON.stringify(feeConfig)],
    });
  }

  for (const e of history) {
    statements.push({
      sql: INSERT_HISTORY,
      params: [
        str(e.date),
        num(e.totalValue),
        num(e.totalCost),
        num(e.gainLoss),
        e.kse100 == null ? null : num(e.kse100),
        e.shares ? JSON.stringify(e.shares) : null,
      ],
    });
  }

  if (lastFetchedAt != null) {
    statements.push({
      sql: "INSERT INTO meta (key, value) VALUES (?, ?)",
      params: ["lastFetchedAt", lastFetchedAt],
    });
  }
  statements.push({
    sql: "INSERT INTO meta (key, value) VALUES (?, ?)",
    params: ["savedAt", savedAt],
  });

  await db.batch(statements);
}
