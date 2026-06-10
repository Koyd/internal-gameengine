import { UserSetting } from "@internal/contracts"
import { UserState } from "@internal/runtime-domain"
import { Effect, Layer } from "effect"
import { SqliteDatabase } from "./sqlite-database.ts"

export const SqliteUserState = {
  layer: Layer.effect(
    UserState,
    Effect.gen(function* () {
      const database = yield* SqliteDatabase
      const get = database.prepare(
        "SELECT key, value, updated_at FROM user_settings WHERE key = @key",
      )
      const set = database.prepare(
        `INSERT INTO user_settings (key, value, updated_at)
         VALUES (@key, @value, @updatedAt)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )

      return UserState.of({
        get: Effect.fn("SqliteUserState.get")((key: string) =>
          Effect.sync(() => {
            const row = get.get({ key }) as
              | { key: string; value: string; updated_at: string }
              | undefined
            return row
              ? new UserSetting({
                  key: row.key,
                  value: row.value,
                  updatedAt: row.updated_at,
                })
              : null
          }),
        ),
        set: Effect.fn("SqliteUserState.set")((key: string, value: string) =>
          Effect.sync(() => {
            const setting = new UserSetting({ key, value, updatedAt: new Date().toISOString() })
            set.run({ key, value, updatedAt: setting.updatedAt })
            return setting
          }),
        ),
      })
    }),
  ),
}
