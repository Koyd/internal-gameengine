import type { Camera, Scene } from "@internal/three"
import type { GameAssets } from "./assets.ts"
import type { RenderProcess } from "./rendering/frame-pipeline.ts"

export type GameTarget = "web" | "electron" | "mobile"

export interface GameConfig {
  readonly assetsDirectory: string
  readonly id: string
  readonly target: GameTarget
  readonly title: string
}

export interface GameContext {
  readonly assets: GameAssets
}

export interface GameWorld {
  readonly camera: Camera
  readonly postprocess?: ReadonlyArray<RenderProcess>
  readonly preprocess?: ReadonlyArray<RenderProcess>
  readonly scene: Scene
}

export interface GameDefinition {
  readonly createWorld: (context: GameContext) => GameWorld
}

export interface Game extends GameDefinition {
  readonly config: GameConfig
  readonly id: string
  readonly title: string
}

export const defineGameConfig = <const Config extends GameConfig>(config: Config): Config => config

export const defineGame = <const Config extends GameConfig>(
  config: Config,
  definition: GameDefinition,
): Game => ({
  ...definition,
  config,
  id: config.id,
  title: config.title,
})
