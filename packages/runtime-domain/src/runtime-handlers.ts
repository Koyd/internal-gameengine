import { RuntimeRpcs } from "@internal/contracts"
import { Effect } from "effect"
import { GameStorage } from "./game-storage.ts"
import { GameAssets } from "./game-assets.ts"
import { UserState } from "./user-state.ts"

export const RuntimeHandlers = RuntimeRpcs.toLayer(
  Effect.gen(function* () {
    const userState = yield* UserState
    const gameStorage = yield* GameStorage
    const gameAssets = yield* GameAssets

    return {
      Health: () => Effect.succeed({ status: "ok" as const, runtime: "web" }),
      GetUserSetting: ({ key }) => userState.get(key),
      SetUserSetting: ({ key, value }) => userState.set(key, value),
      ListGameStorageEntries: ({ gameId, collection }) => gameStorage.list(gameId, collection),
      AppendGameStorageEntry: ({ gameId, collection, value }) =>
        gameStorage.append(gameId, collection, value),
      ResolveGameAsset: ({ gameId, path }) => gameAssets.resolve(gameId, path),
    }
  }),
)
