import { Layer } from "effect"
import { SqliteDatabase } from "./services/sqlite-database.ts"
import { SqliteAppStorage } from "./services/sqlite-app-storage.ts"
import { SqliteUserState } from "./services/sqlite-user-state.ts"

export const PersistenceLive = Layer.merge(SqliteUserState.layer, SqliteAppStorage.layer).pipe(
  Layer.provide(SqliteDatabase.layer),
)
