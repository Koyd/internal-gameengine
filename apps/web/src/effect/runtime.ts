import { RuntimeClient } from "@internal/clientstate"
import {
  createGameAssets,
  createGameLocalStorage,
  type GameAssets,
  type GameConfig,
  type GameLocalStorage,
} from "@internal/engine"
import { Effect, ManagedRuntime } from "effect"

const layer =
  import.meta.env["VITE_GAME_TARGET"] === "electron"
    ? RuntimeClient.ipc(
        window.gameEngineDesktop ??
          ({
            invoke: () => Promise.reject(new Error("Electron IPC bridge is unavailable")),
          } as const),
      )
    : RuntimeClient.http(new URL(window.location.origin))

export const BrowserRuntime = ManagedRuntime.make(layer)

export const getRuntimeHealth = RuntimeClient.pipe(Effect.flatMap((client) => client.health))

export const createRuntimeGameAssets = (config: GameConfig): GameAssets =>
  createGameAssets(config.id, {
    resolve: (gameId, path) =>
      BrowserRuntime.runPromise(
        RuntimeClient.pipe(
          Effect.flatMap((client) => client.resolveGameAsset(gameId, path)),
          Effect.map((asset) =>
            import.meta.env["VITE_GAME_TARGET"] === "electron"
              ? `game-asset://${encodeURIComponent(asset.gameId)}/${encodeAssetPath(asset.path)}`
              : `/game-assets/${encodeURIComponent(asset.gameId)}/${encodeAssetPath(asset.path)}`,
          ),
        ),
      ),
  })

export const createRuntimeGameLocalStorage = (config: GameConfig): GameLocalStorage =>
  createGameLocalStorage(config.id, {
    list: (requestedGameId, collection) =>
      BrowserRuntime.runPromise(
        RuntimeClient.pipe(
          Effect.flatMap((client) => client.listGameStorageEntries(requestedGameId, collection)),
        ),
      ),
    append: (requestedGameId, collection, value) =>
      BrowserRuntime.runPromise(
        RuntimeClient.pipe(
          Effect.flatMap((client) =>
            client.appendGameStorageEntry(requestedGameId, collection, value),
          ),
        ),
      ),
  })

const encodeAssetPath = (path: string): string =>
  path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")
