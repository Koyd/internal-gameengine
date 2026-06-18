import type { AppStorageEntry } from "@framework/contracts"
import { Context, Effect, Layer, Ref } from "effect"

export interface AppStorageShape {
  readonly list: (
    appId: string,
    collection: string,
  ) => Effect.Effect<ReadonlyArray<AppStorageEntry>>
  readonly append: (
    appId: string,
    collection: string,
    value: string,
  ) => Effect.Effect<AppStorageEntry>
}

export class AppStorage extends Context.Tag("@framework/runtime-domain/AppStorage")<
  AppStorage,
  AppStorageShape
>() {
  static readonly memory = Layer.effect(
    AppStorage,
    Effect.gen(function* () {
      const entries = yield* Ref.make<ReadonlyArray<AppStorageEntry>>([])

      return AppStorage.of({
        list: Effect.fn("AppStorage.list")((appId: string, collection: string) =>
          Ref.get(entries).pipe(
            Effect.map((values) =>
              values.filter((entry) => entry.appId === appId && entry.collection === collection),
            ),
          ),
        ),
        append: Effect.fn("AppStorage.append")((appId: string, collection: string, value: string) =>
          Effect.gen(function* () {
            const current = yield* Ref.get(entries)
            const entry: AppStorageEntry = {
              id: current.length + 1,
              appId,
              collection,
              value,
              createdAt: new Date().toISOString(),
            }
            yield* Ref.update(entries, (values) => [...values, entry])
            return entry
          }),
        ),
      })
    }),
  )
}
