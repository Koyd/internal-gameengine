import { GameStorageEntry } from "@internal/contracts"
import { GameStorage } from "@internal/runtime-domain"
import { Effect, Layer } from "effect"
import { SqliteDatabase } from "./sqlite-database.ts"

interface EntryRow {
  readonly id: number
  readonly game_id: string
  readonly collection: string
  readonly value: string
  readonly created_at: string
}

const fromRow = (row: EntryRow): GameStorageEntry =>
  new GameStorageEntry({
    id: row.id,
    gameId: row.game_id,
    collection: row.collection,
    value: row.value,
    createdAt: row.created_at,
  })

export const SqliteGameStorage = {
  layer: Layer.effect(
    GameStorage,
    Effect.gen(function* () {
      const database = yield* SqliteDatabase
      const list = database.prepare(
        `SELECT id, game_id, collection, value, created_at
         FROM game_storage_entries
         WHERE game_id = @gameId AND collection = @collection
         ORDER BY id ASC`,
      )
      const append = database.prepare(
        `INSERT INTO game_storage_entries (game_id, collection, value, created_at)
         VALUES (@gameId, @collection, @value, @createdAt)
         RETURNING id, game_id, collection, value, created_at`,
      )

      return GameStorage.of({
        list: Effect.fn("SqliteGameStorage.list")((gameId: string, collection: string) =>
          Effect.sync(() =>
            (list.all({ gameId, collection }) as unknown as ReadonlyArray<EntryRow>).map(fromRow),
          ),
        ),
        append: Effect.fn("SqliteGameStorage.append")(
          (gameId: string, collection: string, value: string) =>
            Effect.sync(() => {
              const row = append.get({
                gameId,
                collection,
                value,
                createdAt: new Date().toISOString(),
              }) as unknown as EntryRow
              return fromRow(row)
            }),
        ),
      })
    }),
  ),
}
