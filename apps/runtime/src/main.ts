import { NodeRuntime } from "@effect/platform-node"
import { exampleAppConfig } from "@framework/example-app/config"
import { Layer } from "effect"
import { resolve } from "node:path"
import { PersistenceLive } from "./persistence.ts"
import { RuntimeServer } from "./runtime-server.ts"
import { FileSystemAppAssets } from "./services/filesystem-app-assets.ts"

const workspaceDirectory = resolve(import.meta.dirname, "../../..")
const AppAssetsLive = FileSystemAppAssets.layer({
  appId: exampleAppConfig.id,
  sourceDirectory: resolve(workspaceDirectory, exampleAppConfig.assetsDirectory),
  cacheDirectory: resolve(workspaceDirectory, ".data", "assets", exampleAppConfig.id),
})

const MainLayer = RuntimeServer.layer.pipe(
  Layer.provide(Layer.merge(PersistenceLive, AppAssetsLive)),
)

NodeRuntime.runMain(Layer.launch(MainLayer))
