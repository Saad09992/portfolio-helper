// Normalized SQLite storage for the portfolio bundle. Presents the exact same
// bundle shape the client's /api/portfolio/load|save contract expects, so the
// frontend is unchanged — only the storage backend moved off flat JSON.

import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { runMigrations } from "./migrations.mjs";

let cached = null; // { path, db }

// Open (once per path) a WAL-mode connection with migrations applied. Reused
// across the API save route and the cron job so both share one source of truth.
export function getPortfolioDb(dbPath) {
  if (cached && cached.path === dbPath) return cached.db;
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  cached = { path: dbPath, db };
  return db;
}

function getMeta(db, key) {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? row.value : null;
}

// Assemble the bundle from the normalized tables. Returns null when nothing has
// ever been saved (no savedAt sentinel) so the client falls back to its seed,
// matching the old "portfolio.json missing → null" behavior.
export function loadBundle(db) {
  const savedAt = getMeta(db, "savedAt");
  if (savedAt == null) return null;

  const payoutRows = db
    .prepare("SELECT * FROM payouts ORDER BY holding_id, seq")
    .all();
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

  const holdings = db
    .prepare("SELECT * FROM holdings ORDER BY seq")
    .all()
    .map((h) => {
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

  const cashRow = db.prepare("SELECT available FROM cash WHERE id = 1").get();
  const cash = { available: cashRow ? cashRow.available : 0 };

  const targets = db
    .prepare("SELECT * FROM targets ORDER BY seq")
    .all()
    .map((t) => {
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

  const investments = db
    .prepare("SELECT * FROM investments ORDER BY seq")
    .all()
    .map((i) => ({
      id: i.id,
      date: i.date,
      label: i.label,
      amount: i.amount,
      valueEom: i.valueEom,
    }));

  const transactions = db
    .prepare("SELECT * FROM transactions ORDER BY seq")
    .all()
    .map((t) => {
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

  const feeRow = db.prepare("SELECT json FROM fee_config WHERE id = 1").get();
  let feeConfig = null;
  if (feeRow?.json) {
    try {
      feeConfig = JSON.parse(feeRow.json);
    } catch {
      /* ignore malformed — client falls back to defaults */
    }
  }

  const history = db
    .prepare("SELECT * FROM portfolio_history ORDER BY date")
    .all()
    .map((row) => {
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

  const bundle = {
    holdings,
    cash,
    targets,
    investments,
    transactions,
    feeConfig,
    history,
    lastFetchedAt: getMeta(db, "lastFetchedAt"),
    savedAt,
  };
  return bundle;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v) => (v == null ? "" : String(v));

// Disassemble the bundle into the normalized tables inside a single
// transaction. Full-replace semantics match the whole-bundle contract.
export function saveBundle(db, bundle) {
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

  const tx = db.transaction(() => {
    db.exec(
      "DELETE FROM payouts; DELETE FROM holdings; DELETE FROM cash; DELETE FROM targets; DELETE FROM investments; DELETE FROM transactions; DELETE FROM fee_config; DELETE FROM portfolio_history; DELETE FROM meta;",
    );

    const insHolding = db.prepare(
      `INSERT INTO holdings (id, ticker, name, sector, account, shares, price, costBasis, dayChangePct, dividendPerShare, payoutDate, seq)
       VALUES (@id, @ticker, @name, @sector, @account, @shares, @price, @costBasis, @dayChangePct, @dividendPerShare, @payoutDate, @seq)`,
    );
    const insPayout = db.prepare(
      `INSERT INTO payouts (holding_id, seq, announcementDate, bookClosureDate, dividendPerShare)
       VALUES (@holding_id, @seq, @announcementDate, @bookClosureDate, @dividendPerShare)`,
    );
    holdings.forEach((h, i) => {
      insHolding.run({
        id: str(h.id),
        ticker: str(h.ticker),
        name: str(h.name),
        sector: str(h.sector),
        account: str(h.account),
        shares: num(h.shares),
        price: num(h.price),
        costBasis: num(h.costBasis),
        dayChangePct: num(h.dayChangePct),
        dividendPerShare: num(h.dividendPerShare),
        payoutDate: str(h.payoutDate),
        seq: i,
      });
      if (Array.isArray(h.payouts)) {
        h.payouts.forEach((p, j) =>
          insPayout.run({
            holding_id: str(h.id),
            seq: j,
            announcementDate: str(p.announcementDate),
            bookClosureDate: str(p.bookClosureDate),
            dividendPerShare: num(p.dividendPerShare),
          }),
        );
      }
    });

    db.prepare("INSERT INTO cash (id, available) VALUES (1, ?)").run(cashAvailable);

    const insTarget = db.prepare(
      `INSERT INTO targets (id, mode, key, targetWeight, warnThreshold, criticalThreshold, cadence, lastRebalancedAt, seq)
       VALUES (@id, @mode, @key, @targetWeight, @warnThreshold, @criticalThreshold, @cadence, @lastRebalancedAt, @seq)`,
    );
    targets.forEach((t, i) =>
      insTarget.run({
        id: str(t.id),
        mode: str(t.mode),
        key: str(t.key),
        targetWeight: num(t.targetWeight),
        warnThreshold: t.warnThreshold == null ? null : num(t.warnThreshold),
        criticalThreshold: t.criticalThreshold == null ? null : num(t.criticalThreshold),
        cadence: t.cadence == null ? null : String(t.cadence),
        lastRebalancedAt: t.lastRebalancedAt == null ? null : String(t.lastRebalancedAt),
        seq: i,
      }),
    );

    const insInvest = db.prepare(
      `INSERT INTO investments (id, date, label, amount, valueEom, seq)
       VALUES (@id, @date, @label, @amount, @valueEom, @seq)`,
    );
    investments.forEach((iv, i) =>
      insInvest.run({
        id: str(iv.id),
        date: str(iv.date),
        label: str(iv.label),
        amount: num(iv.amount),
        valueEom: num(iv.valueEom),
        seq: i,
      }),
    );

    const insTxn = db.prepare(
      `INSERT INTO transactions (id, date, type, ticker, name, sector, shares, price, amount, ratioFrom, ratioTo, feeOverride, note, seq)
       VALUES (@id, @date, @type, @ticker, @name, @sector, @shares, @price, @amount, @ratioFrom, @ratioTo, @feeOverride, @note, @seq)`,
    );
    transactions.forEach((t, i) =>
      insTxn.run({
        id: str(t.id),
        date: str(t.date),
        type: str(t.type),
        ticker: str(t.ticker).toUpperCase(),
        name: str(t.name),
        sector: str(t.sector),
        shares: num(t.shares),
        price: num(t.price),
        amount: num(t.amount),
        ratioFrom: t.ratioFrom == null ? null : num(t.ratioFrom),
        ratioTo: t.ratioTo == null ? null : num(t.ratioTo),
        feeOverride:
          t.feeOverride && typeof t.feeOverride === "object"
            ? JSON.stringify(t.feeOverride)
            : null,
        note: str(t.note),
        seq: i,
      }),
    );

    if (feeConfig) {
      db.prepare("INSERT INTO fee_config (id, json) VALUES (1, ?)").run(
        JSON.stringify(feeConfig),
      );
    }

    const insHist = db.prepare(
      `INSERT INTO portfolio_history (date, totalValue, totalCost, gainLoss, kse100, shares_json)
       VALUES (@date, @totalValue, @totalCost, @gainLoss, @kse100, @shares_json)`,
    );
    for (const e of history) {
      insHist.run({
        date: str(e.date),
        totalValue: num(e.totalValue),
        totalCost: num(e.totalCost),
        gainLoss: num(e.gainLoss),
        kse100: e.kse100 == null ? null : num(e.kse100),
        shares_json: e.shares ? JSON.stringify(e.shares) : null,
      });
    }

    const insMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
    if (lastFetchedAt != null) insMeta.run("lastFetchedAt", lastFetchedAt);
    insMeta.run("savedAt", savedAt);
  });

  tx();
}
