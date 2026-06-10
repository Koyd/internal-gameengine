import { NodeRuntime } from "@effect/platform-node"
import { exampleGameConfig } from "@internal/example-game/config"
import { Layer } from "effect"
import { resolve } from "node:path"
import { PersistenceLive } from "./persistence.ts"
import { RuntimeServer } from "./runtime-server.ts"
import { FileSystemGameAssets } from "./services/filesystem-game-assets.ts"

const workspaceDirectory = resolve(import.meta.dirname, "../../..")
const GameAssetsLive = FileSystemGameAssets.layer({
  gameId: exampleGameConfig.id,
  sourceDirectory: resolve(workspaceDirectory, exampleGameConfig.assetsDirectory),
  cacheDirectory: resolve(workspaceDirectory, ".data", "assets", exampleGameConfig.id),
})

const MainLayer = RuntimeServer.layer.pipe(
  Layer.provide(Layer.merge(PersistenceLive, GameAssetsLive)),
)

NodeRuntime.runMain(Layer.launch(MainLayer))
