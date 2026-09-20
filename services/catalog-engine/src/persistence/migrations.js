import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const migrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../migrations",
)

const MIGRATIONS = Object.freeze([
  { version: 1, name: "initial", file: "001_initial.sql" },
  { version: 2, name: "immutable_ledger", file: "002_immutable_ledger.sql" },
  { version: 3, name: "siscomex_snapshots", file: "003_siscomex_snapshots.sql" },
])

export function runMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)
  const applied = database
    .prepare("SELECT version FROM schema_migrations")
    .all()
    .map((row) => row.version)
  const applyMigration = database.transaction((migration) => {
    database.exec(readFileSync(resolve(migrationDirectory, migration.file), "utf8"))
    database
      .prepare(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      )
      .run(migration.version, migration.name, new Date().toISOString())
  })

  for (const migration of MIGRATIONS) {
    if (!applied.includes(migration.version)) applyMigration(migration)
  }
}

export { MIGRATIONS }
