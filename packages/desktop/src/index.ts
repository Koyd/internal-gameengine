import { AppAssetError, RuntimeIpcFailure, RuntimeIpcRequest } from "@framework/contracts"
import type { AppConfig } from "@framework/engine"
import { FileSystemAppAssets } from "@framework/runtime/assets"
import { PersistenceLive } from "@framework/runtime/persistence"
import {
  AppAssets,
  appAssetErrorStatus,
  appAssetMatchesVersion,
  appAssetResponseHeaders,
  handleRuntimeRequest,
} from "@framework/runtime-domain"
import { Effect, Layer, ManagedRuntime, Schema, Stream } from "effect"
import { app, BrowserWindow, ipcMain, protocol } from "electron"
import { join } from "node:path"

const channel = "framework:runtime"
const decodeRequest = Schema.decodeUnknown(RuntimeIpcRequest)

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app-asset",
    privileges: {
      corsEnabled: true,
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
])

export const runDesktop = async (config: AppConfig): Promise<void> => {
  app.setName(config.title)
  await app.whenReady()

  process.env["FRAMEWORK_STATE_PATH"] = join(app.getPath("userData"), "data", "framework.sqlite")
  const AppAssetsLive = FileSystemAppAssets.layer({
    appId: config.id,
    sourceDirectory: join(process.resourcesPath, config.assetsDirectory),
    cacheDirectory: join(app.getPath("userData"), "cache", "assets"),
  })
  const runtime = ManagedRuntime.make(Layer.merge(PersistenceLive, AppAssetsLive))

  ipcMain.handle(channel, (_event, input: unknown) =>
    runtime.runPromise(
      decodeRequest(input).pipe(
        Effect.flatMap(handleRuntimeRequest),
        Effect.catchTag("AppAssetError", (error) =>
          Effect.succeed(new RuntimeIpcFailure({ _tag: "RuntimeIpcFailure", error })),
        ),
      ),
    ),
  )

  protocol.handle("app-asset", async (request) => {
    try {
      const url = new URL(request.url)
      const opened = await runtime.runPromise(
        AppAssets.pipe(
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
        appAssetMatchesVersion(opened.asset, request.headers.get("if-none-match") ?? undefined)
      ) {
        return new Response(null, {
          headers: appAssetResponseHeaders(opened.asset),
          status: 304,
        })
      }
      return new Response(Stream.toReadableStream(opened.stream), {
        headers: appAssetResponseHeaders(opened.asset, opened.range),
        status: opened.range ? 206 : 200,
      })
    } catch (cause) {
      const error = Schema.is(AppAssetError)(cause)
        ? cause
        : new AppAssetError({
            appId: "",
            message: cause instanceof Error ? cause.message : String(cause),
            path: "",
            reason: "Io",
          })
      return new Response(error.message, {
        headers: { "accept-ranges": "bytes", "cache-control": "no-cache" },
        status: appAssetErrorStatus(error),
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
    protocol.unhandle("app-asset")
    void runtime.dispose()
  })
}
