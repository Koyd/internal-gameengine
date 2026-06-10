import { NodeStream } from "@effect/platform-node"
import { GameAssetError, ResolvedGameAsset } from "@internal/contracts"
import { GameAssets, gameAssetContentType, parseGameAssetRange } from "@internal/runtime-domain"
import { Effect, Layer } from "effect"
import { createReadStream } from "node:fs"
import { copyFile, mkdir, stat } from "node:fs/promises"
import { dirname, relative, resolve, sep } from "node:path"

export interface FileSystemGameAssetsOptions {
  readonly cacheDirectory: string
  readonly gameId: string
  readonly sourceDirectory: string
}

const assetPrefix = "://assets/"

export const FileSystemGameAssets = {
  layer: ({ cacheDirectory, gameId, sourceDirectory }: FileSystemGameAssetsOptions) =>
    Layer.succeed(
      GameAssets,
      GameAssets.of({
        resolve: (requestedGameId, path) =>
          resolveCachedAsset({
            cacheDirectory,
            gameId,
            requestedGameId,
            sourceDirectory,
            path,
          }).pipe(Effect.map(({ cachePath: _cachePath, ...asset }) => asset)),
        open: (requestedGameId, path, rangeHeader) =>
          Effect.gen(function* () {
            const cached = yield* resolveCachedAsset({
              cacheDirectory,
              gameId,
              requestedGameId,
              sourceDirectory,
              path,
            })
            const range = yield* parseGameAssetRange(
              cached.gameId,
              cached.path,
              cached.size,
              rangeHeader,
            )
            const stream = NodeStream.fromReadable(
              () => createReadStream(cached.cachePath, range),
              (cause) => assetError(cached.gameId, cached.path, "Io", cause),
            )
            const { cachePath: _cachePath, ...asset } = cached
            return { asset, stream, ...(range ? { range } : {}) }
          }),
      }),
    ),
}

interface CachedAsset extends ResolvedGameAsset {
  readonly cachePath: string
}

interface ResolveOptions extends FileSystemGameAssetsOptions {
  readonly path: string
  readonly requestedGameId: string
}

const resolveCachedAsset = ({
  cacheDirectory,
  gameId,
  path,
  requestedGameId,
  sourceDirectory,
}: ResolveOptions): Effect.Effect<CachedAsset, GameAssetError> =>
  Effect.tryPromise({
    try: async () => {
      if (requestedGameId !== gameId) {
        throw assetError(requestedGameId, path, "UnknownGame", `Unknown game "${requestedGameId}"`)
      }

      const assetPath = normalizeAssetPath(gameId, path)
      const sourcePath = inside(gameId, assetPath, sourceDirectory)
      const cachePath = inside(gameId, assetPath, cacheDirectory)
      const source = await stat(sourcePath).catch((cause: unknown) => {
        throw assetError(gameId, assetPath, isNotFound(cause) ? "NotFound" : "Io", cause)
      })
      if (!source.isFile()) throw assetError(gameId, assetPath, "NotFile", "Asset is not a file")

      let cached = false
      try {
        const cache = await stat(cachePath)
        cached = cache.isFile() && cache.mtimeMs >= source.mtimeMs && cache.size === source.size
      } catch {
        // Cache misses are expected and refresh from the configured source.
      }

      if (!cached) {
        await mkdir(dirname(cachePath), { recursive: true })
        await copyFile(sourcePath, cachePath)
      }

      return {
        contentType: gameAssetContentType(assetPath),
        gameId,
        path: assetPath,
        size: source.size,
        version: `${source.size}-${Math.trunc(source.mtimeMs)}`,
        cachePath,
      }
    },
    catch: (cause) =>
      cause instanceof GameAssetError ? cause : assetError(gameId, path, "Io", cause),
  })

const normalizeAssetPath = (gameId: string, path: string): string => {
  let decoded: string
  try {
    decoded = decodeURIComponent(
      path.startsWith(assetPrefix) ? path.slice(assetPrefix.length) : path,
    )
  } catch (cause) {
    throw assetError(gameId, path, "InvalidPath", cause)
  }
  if (!decoded || decoded.startsWith("/") || decoded.includes("\0")) {
    throw assetError(gameId, path, "InvalidPath", "Asset path is empty or absolute")
  }
  return decoded
}

const inside = (gameId: string, path: string, root: string): string => {
  const absoluteRoot = resolve(root)
  const absolutePath = resolve(absoluteRoot, path)
  const child = relative(absoluteRoot, absolutePath)
  if (!child || child === ".." || child.startsWith(`..${sep}`)) {
    throw assetError(gameId, path, "InvalidPath", "Asset path escapes its configured directory")
  }
  return absolutePath
}

const assetError = (
  gameId: string,
  path: string,
  reason: GameAssetError["reason"],
  cause: unknown,
): GameAssetError =>
  new GameAssetError({
    gameId,
    path,
    reason,
    message: cause instanceof Error ? cause.message : String(cause),
  })

const isNotFound = (cause: unknown): boolean =>
  typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT"
