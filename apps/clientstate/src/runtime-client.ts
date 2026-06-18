import { registerPlugin } from "@capacitor/core"
import { BrowserHttpClient } from "@effect/platform-browser"
import { RpcClient, RpcSerialization } from "@effect/rpc"
import {
  type AppStorageEntry,
  type ResolvedAppAsset,
  type RuntimeIpc,
  RuntimeIpcFailure,
  type RuntimeMobile,
  RuntimeMobileFailure,
  type RuntimeMobileRequest,
  RuntimeRpcs,
  type UserSetting,
} from "@framework/contracts"
import { Context, Effect, Layer, Schema } from "effect"

export interface RuntimeClientShape {
  readonly health: Effect.Effect<{ readonly status: "ok"; readonly runtime: string }, unknown>
  readonly getUserSetting: (key: string) => Effect.Effect<UserSetting | null, unknown>
  readonly setUserSetting: (key: string, value: string) => Effect.Effect<UserSetting, unknown>
  readonly listAppStorageEntries: (
    appId: string,
    collection: string,
  ) => Effect.Effect<ReadonlyArray<AppStorageEntry>, unknown>
  readonly appendAppStorageEntry: (
    appId: string,
    collection: string,
    value: string,
  ) => Effect.Effect<AppStorageEntry, unknown>
  readonly resolveAppAsset: (
    appId: string,
    path: string,
  ) => Effect.Effect<ResolvedAppAsset, unknown>
}

export class RuntimeClient extends Context.Tag("@framework/clientstate/RuntimeClient")<
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
            listAppStorageEntries: (appId, collection) =>
              client.ListAppStorageEntries({ appId, collection }),
            appendAppStorageEntry: (appId, collection, value) =>
              client.AppendAppStorageEntry({ appId, collection, value }),
            resolveAppAsset: (appId, path) => client.ResolveAppAsset({ appId, path }),
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
        listAppStorageEntries: (appId, collection) =>
          invoke(ipc, { _tag: "ListAppStorageEntries", appId, collection }),
        appendAppStorageEntry: (appId, collection, value) =>
          invoke(ipc, { _tag: "AppendAppStorageEntry", appId, collection, value }),
        resolveAppAsset: (appId, path) => invoke(ipc, { _tag: "ResolveAppAsset", appId, path }),
      }),
    )

  static readonly capacitor = () =>
    RuntimeClient.mobile(registerPlugin<RuntimeMobile>("FrameworkRuntime"))

  static readonly mobile = (mobile: RuntimeMobile) =>
    Layer.succeed(
      RuntimeClient,
      RuntimeClient.of({
        health: invokeMobile(mobile, { _tag: "Health" }),
        getUserSetting: (key) => invokeMobile(mobile, { _tag: "GetUserSetting", key }),
        setUserSetting: (key, value) =>
          invokeMobile(mobile, { _tag: "SetUserSetting", key, value }),
        listAppStorageEntries: (appId, collection) =>
          invokeMobile(mobile, { _tag: "ListAppStorageEntries", appId, collection }),
        appendAppStorageEntry: (appId, collection, value) =>
          invokeMobile(mobile, {
            _tag: "AppendAppStorageEntry",
            appId,
            collection,
            value,
          }),
        resolveAppAsset: (appId, path) =>
          invokeMobile(mobile, { _tag: "ResolveAppAsset", appId, path }),
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

const invokeMobile = <Result>(mobile: RuntimeMobile, request: RuntimeMobileRequest) =>
  Effect.tryPromise({
    try: async () => {
      const response = await mobile.invoke({ request })
      const result = unwrapMobileResult(response)
      if (isMobileFailure(result)) throw result.error
      return result as Result
    },
    catch: (cause) => cause,
  })

const unwrapMobileResult = (response: unknown): unknown => {
  if (
    typeof response === "object" &&
    response !== null &&
    "result" in response &&
    Object.keys(response).length === 1
  ) {
    return response.result
  }
  return response
}

const isMobileFailure = (
  value: unknown,
): value is { readonly _tag: "RuntimeMobileFailure"; readonly error: unknown } =>
  Schema.is(RuntimeMobileFailure)(value) ||
  (typeof value === "object" &&
    value !== null &&
    "_tag" in value &&
    value._tag === "RuntimeMobileFailure" &&
    "error" in value)
