import { RuntimeClient } from "@framework/clientstate"
import {
  createAppAssets,
  createAppLocalStorage,
  type AppAssets,
  type AppConfig,
  type AppLocalStorage,
} from "@framework/engine"
import { Effect, ManagedRuntime } from "effect"

const appTarget = import.meta.env["VITE_APP_TARGET"]

const layer =
  appTarget === "electron"
    ? RuntimeClient.ipc(
        window.frameworkDesktop ??
          ({
            invoke: () => Promise.reject(new Error("Electron IPC bridge is unavailable")),
          } as const),
      )
    : appTarget === "android" || appTarget === "ios"
      ? RuntimeClient.capacitor()
      : RuntimeClient.http(new URL(window.location.origin))

export const BrowserRuntime = ManagedRuntime.make(layer)

export const getRuntimeHealth = RuntimeClient.pipe(Effect.flatMap((client) => client.health))

export const createRuntimeAppAssets = (config: AppConfig): AppAssets =>
  createAppAssets(config.id, {
    resolve: (appId, path) =>
      BrowserRuntime.runPromise(
        RuntimeClient.pipe(
          Effect.flatMap((client) => client.resolveAppAsset(appId, path)),
          Effect.map((asset) =>
            appTarget === "electron"
              ? `app-asset://${encodeURIComponent(asset.appId)}/${encodeAssetPath(asset.path)}`
              : `/app-assets/${encodeURIComponent(asset.appId)}/${encodeAssetPath(asset.path)}`,
          ),
        ),
      ),
  })

export const createRuntimeAppLocalStorage = (config: AppConfig): AppLocalStorage =>
  createAppLocalStorage(config.id, {
    list: (requestedAppId, collection) =>
      BrowserRuntime.runPromise(
        RuntimeClient.pipe(
          Effect.flatMap((client) => client.listAppStorageEntries(requestedAppId, collection)),
        ),
      ),
    append: (requestedAppId, collection, value) =>
      BrowserRuntime.runPromise(
        RuntimeClient.pipe(
          Effect.flatMap((client) =>
            client.appendAppStorageEntry(requestedAppId, collection, value),
          ),
        ),
      ),
  })

const encodeAssetPath = (path: string): string =>
  path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")
