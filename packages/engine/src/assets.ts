import { GLTFLoader, TextureLoader, type GLTF, type Object3D, type Texture } from "@framework/three"

export type AppAssetPath = `://assets/${string}`

export interface AppAssetTransport {
  readonly resolve: (appId: string, path: AppAssetPath) => Promise<string>
}

export interface AppAssets {
  readonly loadGLTF: (path: AppAssetPath) => Promise<GLTF>
  readonly loadModel: (path: AppAssetPath) => Promise<Object3D>
  readonly loadText: (path: AppAssetPath) => Promise<string>
  readonly loadTexture: (path: AppAssetPath) => Promise<Texture>
  readonly resolve: (path: AppAssetPath) => Promise<string>
}

export const createAppAssets = (appId: string, transport: AppAssetTransport): AppAssets => {
  const resolve = (path: AppAssetPath) => transport.resolve(appId, path)

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
