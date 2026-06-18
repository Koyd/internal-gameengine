import { AppStorageEntry } from "@framework/contracts"
import { AppStorage } from "@framework/runtime-domain"
import { Effect, Layer } from "effect"
import { SqliteDatabase } from "./sqlite-database.ts"

interface EntryRow {
  readonly id: number
  readonly app_id: string
  readonly collection: string
  readonly value: string
  readonly created_at: string
}

const fromRow = (row: EntryRow): AppStorageEntry =>
  new AppStorageEntry({
    id: row.id,
    appId: row.app_id,
    collection: row.collection,
    value: row.value,
    createdAt: row.created_at,
  })

export const SqliteAppStorage = {
  layer: Layer.effect(
    AppStorage,
    Effect.gen(function* () {
      const database = yield* SqliteDatabase
      const list = database.prepare(
        `SELECT id, app_id, collection, value, created_at
         FROM app_storage_entries
         WHERE app_id = @appId AND collection = @collection
         ORDER BY id ASC`,
      )
      const append = database.prepare(
        `INSERT INTO app_storage_entries (app_id, collection, value, created_at)
         VALUES (@appId, @collection, @value, @createdAt)
         RETURNING id, app_id, collection, value, created_at`,
      )

      return AppStorage.of({
        list: Effect.fn("SqliteAppStorage.list")((appId: string, collection: string) =>
          Effect.sync(() =>
            (list.all({ appId, collection }) as unknown as ReadonlyArray<EntryRow>).map(fromRow),
          ),
        ),
        append: Effect.fn("SqliteAppStorage.append")(
          (appId: string, collection: string, value: string) =>
            Effect.sync(() => {
              const row = append.get({
                appId,
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
