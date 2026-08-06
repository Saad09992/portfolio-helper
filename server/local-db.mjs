// better-sqlite3 backing for the two non-Workers execution paths: the test
// suite and the Node/Docker server that remains as the deployment rollback.
//
// The schema is read from migrations/*.sql rather than duplicated here, so both
// paths exercise the exact DDL that D1 runs. A second copy would drift.

import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { sqliteAdapter } from "./db-adapter.mjs";

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** Apply every migration, in filename order, to an open better-sqlite3 db. */
export function applySchema(db) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf-8"));
  }
  return db;
}

/** Open (and migrate) an on-disk portfolio database, returned as an adapter. */
export function openLocalDb(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return sqliteAdapter(db);
}

/** Fresh in-memory database, schema applied, returned as an adapter. */
export function freshTestDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return sqliteAdapter(db);
}
