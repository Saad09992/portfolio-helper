// Bake the read-only reference stock list out of data/psx-stocks.db into
// public/psx-stocks.json, which Vite copies into dist/ and Workers Assets
// serves. Replaces opening a SQLite database per request in /api/psx/stocks.
//
// Run after scripts/fetch-stocks.mjs refreshes the database:
//   npm run export-stocks

import Database from "better-sqlite3";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = resolve(ROOT, "data/psx-stocks.db");
const OUT_PATH = resolve(ROOT, "public/psx-stocks.json");

if (!existsSync(DB_PATH)) {
  console.error(`[psx] ${DB_PATH} not found. Run "npm run fetch-stocks" first.`);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });
// Same query the old /api/psx/stocks route ran, so the JSON shape is identical.
const rows = db
  .prepare(
    "SELECT s.ticker, s.name, sec.name as sector FROM stocks s JOIN sectors sec ON s.sector = sec.code ORDER BY s.ticker",
  )
  .all();
db.close();

if (rows.length === 0) {
  console.error("[psx] refusing to write an empty stock list");
  process.exit(1);
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(rows));
console.log(`[psx] wrote ${rows.length} stocks → public/psx-stocks.json`);
