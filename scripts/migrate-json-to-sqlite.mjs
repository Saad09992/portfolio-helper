// One-time migration: data/portfolio.json → data/portfolio.sqlite (normalized).
// Idempotent — saveBundle full-replaces, so re-running is safe. The source JSON
// is left in place as a backup; delete it manually once you've verified.
//
// Usage: node scripts/migrate-json-to-sqlite.mjs [--data-dir DIR]

import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getPortfolioDb, saveBundle, loadBundle } from "../server/portfolio-db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const argDir = (() => {
  const i = process.argv.indexOf("--data-dir");
  return i >= 0 ? process.argv[i + 1] : null;
})();
const DATA_DIR = argDir
  ? resolve(argDir)
  : process.env.DATA_DIR
    ? resolve(process.env.DATA_DIR)
    : resolve(ROOT, "data");

const JSON_PATH = resolve(DATA_DIR, "portfolio.json");
const SQLITE_PATH = resolve(DATA_DIR, "portfolio.sqlite");

if (!existsSync(JSON_PATH)) {
  console.error(`[migrate] no portfolio.json at ${JSON_PATH} — nothing to do`);
  process.exit(1);
}

const raw = readFileSync(JSON_PATH, "utf-8");
if (!raw.trim() || raw.trim() === "null") {
  console.error("[migrate] portfolio.json is empty/null — nothing to do");
  process.exit(1);
}

const bundle = JSON.parse(raw);

// Money fields migrate rupee-floats → integer paisa. Ratios (targetWeight,
// thresholds), counts (shares), percents (dayChangePct) and the KSE100 index
// level are NOT money and stay as-is.
const toPaisa = (v) => Math.round((Number.isFinite(Number(v)) ? Number(v) : 0) * 100);
const rupeesToPaisaBundle = (b) => ({
  ...b,
  holdings: Array.isArray(b.holdings)
    ? b.holdings.map((h) => ({
        ...h,
        price: toPaisa(h.price),
        costBasis: toPaisa(h.costBasis),
        dividendPerShare: toPaisa(h.dividendPerShare),
        payouts: Array.isArray(h.payouts)
          ? h.payouts.map((p) => ({ ...p, dividendPerShare: toPaisa(p.dividendPerShare) }))
          : h.payouts,
      }))
    : b.holdings,
  cash: b.cash ? { ...b.cash, available: toPaisa(b.cash.available) } : b.cash,
  investments: Array.isArray(b.investments)
    ? b.investments.map((iv) => ({ ...iv, amount: toPaisa(iv.amount), valueEom: toPaisa(iv.valueEom) }))
    : b.investments,
  history: Array.isArray(b.history)
    ? b.history.map((e) => ({
        ...e,
        totalValue: toPaisa(e.totalValue),
        totalCost: toPaisa(e.totalCost),
        gainLoss: toPaisa(e.gainLoss),
      }))
    : b.history,
});

const db = getPortfolioDb(SQLITE_PATH);
saveBundle(db, rupeesToPaisaBundle(bundle));

// Read it back and report a quick shape summary for sanity.
const reloaded = loadBundle(db);
console.log(`[migrate] wrote ${SQLITE_PATH}`);
console.log(
  `[migrate] holdings=${reloaded.holdings.length} targets=${reloaded.targets.length} ` +
    `investments=${reloaded.investments.length} history=${reloaded.history.length} ` +
    `cash=${reloaded.cash.available} savedAt=${reloaded.savedAt}`,
);
console.log("[migrate] source portfolio.json left in place as backup");
