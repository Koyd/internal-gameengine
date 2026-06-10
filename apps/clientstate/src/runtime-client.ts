import { BrowserHttpClient } from "@effect/platform-browser"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import {
  type GameStorageEntry,
  type ResolvedGameAsset,
  type RuntimeIpc,
  RuntimeIpcFailure,
  RuntimeRpcs,
  type UserSetting,
} from "@internal/contracts"
import { Context, Effect, Layer, Schema } from "effect"

export interface RuntimeClientShape {
  readonly health: Effect.Effect<{ readonly status: "ok"; readonly runtime: string }, unknown>
  readonly getUserSetting: (key: string) => Effect.Effect<UserSetting | null, unknown>
  readonly setUserSetting: (key: string, value: string) => Effect.Effect<UserSetting, unknown>
  readonly listGameStorageEntries: (
    gameId: string,
    collection: string,
  ) => Effect.Effect<ReadonlyArray<GameStorageEntry>, unknown>
  readonly appendGameStorageEntry: (
    gameId: string,
    collection: string,
    value: string,
  ) => Effect.Effect<GameStorageEntry, unknown>
  readonly resolveGameAsset: (
    gameId: string,
    path: string,
  ) => Effect.Effect<ResolvedGameAsset, unknown>
}

export class RuntimeClient extends Context.Tag("@internal/clientstate/RuntimeClient")<
  RuntimeClient,
  RuntimeClientShape
>() {
  static readonly http = (baseUrl: URL) => {
    const protocol = RpcClient.layerProtocolHttp({
      url: new URL("/rpc", baseUrl).toString(),
    }).pipe(
      Layer.provide(RpcSerialization.layerJson),
      Layer.provide(BrowserHttpClient.layerXMLHttpRequest),
    )

    return Layer.scoped(
      RuntimeClient,
      RpcClient.make(RuntimeRpcs).pipe(
        Effect.map((client) =>
          RuntimeClient.of({
            health: client.Health(),
            getUserSetting: (key) => client.GetUserSetting({ key }),
            setUserSetting: (key, value) => client.SetUserSetting({ key, value }),
            listGameStorageEntries: (gameId, collection) =>
              client.ListGameStorageEntries({ gameId, collection }),
            appendGameStorageEntry: (gameId, collection, value) =>
              client.AppendGameStorageEntry({ gameId, collection, value }),
            resolveGameAsset: (gameId, path) => client.ResolveGameAsset({ gameId, path }),
          }),
        ),
        Effect.provide(protocol),
      ),
    )
  }

  static readonly ipc = (ipc: RuntimeIpc) =>
    Layer.succeed(
      RuntimeClient,
      RuntimeClient.of({
        health: invoke(ipc, { _tag: "Health" }),
        getUserSetting: (key) => invoke(ipc, { _tag: "GetUserSetting", key }),
        setUserSetting: (key, value) => invoke(ipc, { _tag: "SetUserSetting", key, value }),
        listGameStorageEntries: (gameId, collection) =>
          invoke(ipc, { _tag: "ListGameStorageEntries", gameId, collection }),
        appendGameStorageEntry: (gameId, collection, value) =>
          invoke(ipc, { _tag: "AppendGameStorageEntry", gameId, collection, value }),
        resolveGameAsset: (gameId, path) => invoke(ipc, { _tag: "ResolveGameAsset", gameId, path }),
      }),
    )
}

const invoke = <Result>(ipc: RuntimeIpc, request: Parameters<RuntimeIpc["invoke"]>[0]) =>
  Effect.tryPromise({
    try: async () => {
      const result = await ipc.invoke(request)
      if (Schema.is(RuntimeIpcFailure)(result)) throw result.error
      return result as Result
    },
    catch: (cause) => cause,
  })
