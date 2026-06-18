import { GLTFLoader, TextureLoader, type GLTF, type Object3D, type Texture } from "@internal/three"

export type GameAssetPath = `://assets/${string}`

export interface GameAssetTransport {
  readonly resolve: (gameId: string, path: GameAssetPath) => Promise<string>
}

export interface GameAssets {
  readonly loadGLTF: (path: GameAssetPath) => Promise<GLTF>
  readonly loadModel: (path: GameAssetPath) => Promise<Object3D>
  readonly loadText: (path: GameAssetPath) => Promise<string>
  readonly loadTexture: (path: GameAssetPath) => Promise<Texture>
  readonly resolve: (path: GameAssetPath) => Promise<string>
}

export const createGameAssets = (gameId: string, transport: GameAssetTransport): GameAssets => {
  const resolve = (path: GameAssetPath) => transport.resolve(gameId, path)

  return {
    resolve,
    loadGLTF: async (path) => {
      const url = await resolve(path)
      return new GLTFLoader().loadAsync(url)
    },
    loadModel: async (path) => (await new GLTFLoader().loadAsync(await resolve(path))).scene,
    loadText: async (path) => {
      const response = await fetch(await resolve(path))
      if (!response.ok) throw new Error(`Failed to load text asset "${path}": ${response.status}`)
      return response.text()
    },
    loadTexture: async (path) => new TextureLoader().loadAsync(await resolve(path)),
  }
}
