import type { Camera, Scene } from "@framework/three"
import type { AppAssets } from "./assets.ts"
import type { RenderProcess } from "./rendering/frame-pipeline.ts"

export type AppTarget = "web" | "electron" | "android" | "ios"

export interface AppConfig {
  readonly assetsDirectory: string
  readonly id: string
  readonly target: AppTarget
  readonly title: string
}

export interface AppContext {
  readonly assets: AppAssets
}

export interface AppWorld {
  readonly camera: Camera
  readonly postprocess?: ReadonlyArray<RenderProcess>
  readonly preprocess?: ReadonlyArray<RenderProcess>
  readonly scene: Scene
}

export interface AppDefinition {
  readonly createWorld: (context: AppContext) => AppWorld
}

export interface App extends AppDefinition {
  readonly config: AppConfig
  readonly id: string
  readonly title: string
}

export const defineAppConfig = <const Config extends AppConfig>(config: Config): Config => config

export const defineApp = <const Config extends AppConfig>(
  config: Config,
  definition: AppDefinition,
): App => ({
  ...definition,
  config,
  id: config.id,
  title: config.title,
})
