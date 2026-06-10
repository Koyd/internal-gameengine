import type { RuntimeIpcRequest } from "@internal/contracts"
import { Effect } from "effect"
import { GameStorage } from "./game-storage.ts"
import { GameAssets } from "./game-assets.ts"
import { UserState } from "./user-state.ts"

export const handleRuntimeRequest = (request: RuntimeIpcRequest, runtime = "desktop") =>
  Effect.gen(function* () {
    const userState = yield* UserState
    const gameStorage = yield* GameStorage
    const gameAssets = yield* GameAssets

    switch (request._tag) {
      case "Health":
        return { status: "ok" as const, runtime }
      case "GetUserSetting":
        return yield* userState.get(request.key)
      case "SetUserSetting":
        return yield* userState.set(request.key, request.value)
      case "ListGameStorageEntries":
        return yield* gameStorage.list(request.gameId, request.collection)
      case "AppendGameStorageEntry":
        return yield* gameStorage.append(request.gameId, request.collection, request.value)
      case "ResolveGameAsset":
        return yield* gameAssets.resolve(request.gameId, request.path)
    }
  })
