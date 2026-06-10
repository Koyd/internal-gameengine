import { GameAssetError, RuntimeIpcFailure, RuntimeIpcRequest } from "@internal/contracts"
import type { GameConfig } from "@internal/engine"
import { FileSystemGameAssets } from "@internal/runtime/assets"
import { PersistenceLive } from "@internal/runtime/persistence"
import {
  GameAssets,
  gameAssetErrorStatus,
  gameAssetMatchesVersion,
  gameAssetResponseHeaders,
  handleRuntimeRequest,
} from "@internal/runtime-domain"
import { Effect, Layer, ManagedRuntime, Schema, Stream } from "effect"
import { app, BrowserWindow, ipcMain, protocol } from "electron"
import { join } from "node:path"

const channel = "game-engine:runtime"
const decodeRequest = Schema.decodeUnknown(RuntimeIpcRequest)

protocol.registerSchemesAsPrivileged([
  {
    scheme: "game-asset",
    privileges: {
      corsEnabled: true,
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
])

export const runDesktop = async (config: GameConfig): Promise<void> => {
  app.setName(config.title)
  await app.whenReady()

  process.env["GAMEENGINE_STATE_PATH"] = join(app.getPath("userData"), "data", "game-engine.sqlite")
  const GameAssetsLive = FileSystemGameAssets.layer({
    gameId: config.id,
    sourceDirectory: join(process.resourcesPath, config.assetsDirectory),
    cacheDirectory: join(app.getPath("userData"), "cache", "assets"),
  })
  const runtime = ManagedRuntime.make(Layer.merge(PersistenceLive, GameAssetsLive))

  ipcMain.handle(channel, (_event, input: unknown) =>
    runtime.runPromise(
      decodeRequest(input).pipe(
        Effect.flatMap(handleRuntimeRequest),
        Effect.catchTag("GameAssetError", (error) =>
          Effect.succeed(new RuntimeIpcFailure({ _tag: "RuntimeIpcFailure", error })),
        ),
      ),
    ),
  )

  protocol.handle("game-asset", async (request) => {
    try {
      const url = new URL(request.url)
      const opened = await runtime.runPromise(
        GameAssets.pipe(
          Effect.flatMap((assets) =>
            assets.open(
              url.hostname,
              url.pathname.slice(1),
              request.headers.get("range") ?? undefined,
            ),
          ),
        ),
      )
      if (
        !opened.range &&
        gameAssetMatchesVersion(opened.asset, request.headers.get("if-none-match") ?? undefined)
      ) {
        return new Response(null, {
          headers: gameAssetResponseHeaders(opened.asset),
          status: 304,
        })
      }
      return new Response(Stream.toReadableStream(opened.stream), {
        headers: gameAssetResponseHeaders(opened.asset, opened.range),
        status: opened.range ? 206 : 200,
      })
    } catch (cause) {
      const error = Schema.is(GameAssetError)(cause)
        ? cause
        : new GameAssetError({
            gameId: "",
            message: cause instanceof Error ? cause.message : String(cause),
            path: "",
            reason: "Io",
          })
      return new Response(error.message, {
        headers: { "accept-ranges": "bytes", "cache-control": "no-cache" },
        status: gameAssetErrorStatus(error),
      })
    }
  })

  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    title: config.title,
    backgroundColor: "#080c10",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.cjs"),
      sandbox: false,
    },
  })

  await window.loadFile(join(process.resourcesPath, "web", "index.html"))

  app.on("window-all-closed", () => {
    app.quit()
  })

  app.on("before-quit", () => {
    ipcMain.removeHandler(channel)
    protocol.unhandle("game-asset")
    void runtime.dispose()
  })
}
