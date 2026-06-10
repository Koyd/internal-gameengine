import { Layer } from "effect"
import { SqliteDatabase } from "./services/sqlite-database.ts"
import { SqliteGameStorage } from "./services/sqlite-game-storage.ts"
import { SqliteUserState } from "./services/sqlite-user-state.ts"

export const PersistenceLive = Layer.merge(SqliteUserState.layer, SqliteGameStorage.layer).pipe(
  Layer.provide(SqliteDatabase.layer),
)
