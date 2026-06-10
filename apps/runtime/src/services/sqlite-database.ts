import { Context, Effect, Layer } from "effect"
import { mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { DatabaseSync } from "node:sqlite"

const defaultPath = resolve(".data/game-engine.sqlite")

export class SqliteDatabase extends Context.Tag("@internal/runtime/SqliteDatabase")<
  SqliteDatabase,
  DatabaseSync
>() {
  static readonly layer = Layer.scoped(
    SqliteDatabase,
    Effect.acquireRelease(
      Effect.sync(() => {
        const path = process.env["GAMEENGINE_STATE_PATH"] ?? defaultPath
        mkdirSync(dirname(path), { recursive: true })
        const database = new DatabaseSync(path)
        database.exec("PRAGMA journal_mode = WAL")
        migrate(database)
        return database
      }),
      (database) => Effect.sync(() => database.close()),
    ),
  )
}

const migrate = (database: DatabaseSync): void => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_storage_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      collection TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS game_storage_entries_lookup
      ON game_storage_entries (game_id, collection, id);
  `)
}
