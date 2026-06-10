import type { GameStorageEntry } from "@internal/contracts"
import { Context, Effect, Layer, Ref } from "effect"

export interface GameStorageShape {
  readonly list: (
    gameId: string,
    collection: string,
  ) => Effect.Effect<ReadonlyArray<GameStorageEntry>>
  readonly append: (
    gameId: string,
    collection: string,
    value: string,
  ) => Effect.Effect<GameStorageEntry>
}

export class GameStorage extends Context.Tag("@internal/runtime-domain/GameStorage")<
  GameStorage,
  GameStorageShape
>() {
  static readonly memory = Layer.effect(
    GameStorage,
    Effect.gen(function* () {
      const entries = yield* Ref.make<ReadonlyArray<GameStorageEntry>>([])

      return GameStorage.of({
        list: Effect.fn("GameStorage.list")((gameId: string, collection: string) =>
          Ref.get(entries).pipe(
            Effect.map((values) =>
              values.filter((entry) => entry.gameId === gameId && entry.collection === collection),
            ),
          ),
        ),
        append: Effect.fn("GameStorage.append")(
          (gameId: string, collection: string, value: string) =>
            Effect.gen(function* () {
              const current = yield* Ref.get(entries)
              const entry: GameStorageEntry = {
                id: current.length + 1,
                gameId,
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
