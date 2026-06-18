import { RuntimeRpcs } from "@framework/contracts"
import { Effect } from "effect"
import { AppStorage } from "./app-storage.ts"
import { AppAssets } from "./app-assets.ts"
import { UserState } from "./user-state.ts"

export const RuntimeHandlers = RuntimeRpcs.toLayer(
  Effect.gen(function* () {
    const userState = yield* UserState
    const appStorage = yield* AppStorage
    const appAssets = yield* AppAssets

    return {
      Health: () => Effect.succeed({ status: "ok" as const, runtime: "web" }),
      GetUserSetting: ({ key }) => userState.get(key),
      SetUserSetting: ({ key, value }) => userState.set(key, value),
      ListAppStorageEntries: ({ appId, collection }) => appStorage.list(appId, collection),
      AppendAppStorageEntry: ({ appId, collection, value }) =>
        appStorage.append(appId, collection, value),
      ResolveAppAsset: ({ appId, path }) => appAssets.resolve(appId, path),
    }
  }),
)
