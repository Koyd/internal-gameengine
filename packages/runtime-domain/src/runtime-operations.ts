import type { RuntimeIpcRequest } from "@framework/contracts"
import { Effect } from "effect"
import { AppStorage } from "./app-storage.ts"
import { AppAssets } from "./app-assets.ts"
import { UserState } from "./user-state.ts"

export const handleRuntimeRequest = (request: RuntimeIpcRequest, runtime = "desktop") =>
  Effect.gen(function* () {
    const userState = yield* UserState
    const appStorage = yield* AppStorage
    const appAssets = yield* AppAssets

    switch (request._tag) {
      case "Health":
        return { status: "ok" as const, runtime }
      case "GetUserSetting":
        return yield* userState.get(request.key)
      case "SetUserSetting":
        return yield* userState.set(request.key, request.value)
      case "ListAppStorageEntries":
        return yield* appStorage.list(request.appId, request.collection)
      case "AppendAppStorageEntry":
        return yield* appStorage.append(request.appId, request.collection, request.value)
      case "ResolveAppAsset":
        return yield* appAssets.resolve(request.appId, request.path)
    }
  })
