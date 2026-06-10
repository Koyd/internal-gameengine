import { GLTFLoader, type Object3D } from "@internal/three"

export type GameAssetPath = `://assets/${string}`

export interface GameAssetTransport {
  readonly resolve: (gameId: string, path: GameAssetPath) => Promise<string>
}

export interface GameAssets {
  readonly loadModel: (path: GameAssetPath) => Promise<Object3D>
  readonly resolve: (path: GameAssetPath) => Promise<string>
}

export const createGameAssets = (gameId: string, transport: GameAssetTransport): GameAssets => {
  const resolve = (path: GameAssetPath) => transport.resolve(gameId, path)

  return {
    resolve,
    loadModel: async (path) => {
      const url = await resolve(path)
      const gltf = await new GLTFLoader().loadAsync(url)
      return gltf.scene
    },
  }
}
