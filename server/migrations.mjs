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
