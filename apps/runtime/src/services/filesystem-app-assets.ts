import { NodeStream } from "@effect/platform-node"
import { AppAssetError, ResolvedAppAsset } from "@framework/contracts"
import { AppAssets, appAssetContentType, parseAppAssetRange } from "@framework/runtime-domain"
import { Effect, Layer } from "effect"
import { createReadStream } from "node:fs"
import { copyFile, mkdir, stat } from "node:fs/promises"
import { dirname, relative, resolve, sep } from "node:path"

export interface FileSystemAppAssetsOptions {
  readonly cacheDirectory: string
  readonly appId: string
  readonly sourceDirectory: string
}

const assetPrefix = "://assets/"

export const FileSystemAppAssets = {
  layer: ({ cacheDirectory, appId, sourceDirectory }: FileSystemAppAssetsOptions) =>
    Layer.succeed(
      AppAssets,
      AppAssets.of({
        resolve: (requestedAppId, path) =>
          resolveCachedAsset({
            cacheDirectory,
            appId,
            requestedAppId,
            sourceDirectory,
            path,
          }).pipe(Effect.map(({ cachePath: _cachePath, ...asset }) => asset)),
        open: (requestedAppId, path, rangeHeader) =>
          Effect.gen(function* () {
            const cached = yield* resolveCachedAsset({
              cacheDirectory,
              appId,
              requestedAppId,
              sourceDirectory,
              path,
            })
            const range = yield* parseAppAssetRange(
              cached.appId,
              cached.path,
              cached.size,
              rangeHeader,
            )
            const stream = NodeStream.fromReadable(
              () => createReadStream(cached.cachePath, range),
              (cause) => assetError(cached.appId, cached.path, "Io", cause),
            )
            const { cachePath: _cachePath, ...asset } = cached
            return { asset, stream, ...(range ? { range } : {}) }
          }),
      }),
    ),
}

interface CachedAsset extends ResolvedAppAsset {
  readonly cachePath: string
}

interface ResolveOptions extends FileSystemAppAssetsOptions {
  readonly path: string
  readonly requestedAppId: string
}

const resolveCachedAsset = ({
  cacheDirectory,
  appId,
  path,
  requestedAppId,
  sourceDirectory,
}: ResolveOptions): Effect.Effect<CachedAsset, AppAssetError> =>
  Effect.tryPromise({
    try: async () => {
      if (requestedAppId !== appId) {
        throw assetError(requestedAppId, path, "UnknownApp", `Unknown app "${requestedAppId}"`)
      }

      const assetPath = normalizeAssetPath(appId, path)
      const sourcePath = inside(appId, assetPath, sourceDirectory)
      const cachePath = inside(appId, assetPath, cacheDirectory)
      const source = await stat(sourcePath).catch((cause: unknown) => {
        throw assetError(appId, assetPath, isNotFound(cause) ? "NotFound" : "Io", cause)
      })
      if (!source.isFile()) throw assetError(appId, assetPath, "NotFile", "Asset is not a file")

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
        contentType: appAssetContentType(assetPath),
        appId,
        path: assetPath,
        size: source.size,
        version: `${source.size}-${Math.trunc(source.mtimeMs)}`,
        cachePath,
      }
    },
    catch: (cause) =>
      cause instanceof AppAssetError ? cause : assetError(appId, path, "Io", cause),
  })

const normalizeAssetPath = (appId: string, path: string): string => {
  let decoded: string
  try {
    decoded = decodeURIComponent(
      path.startsWith(assetPrefix) ? path.slice(assetPrefix.length) : path,
    )
  } catch (cause) {
    throw assetError(appId, path, "InvalidPath", cause)
  }
  if (!decoded || decoded.startsWith("/") || decoded.includes("\0")) {
    throw assetError(appId, path, "InvalidPath", "Asset path is empty or absolute")
  }
  return decoded
}

const inside = (appId: string, path: string, root: string): string => {
  const absoluteRoot = resolve(root)
  const absolutePath = resolve(absoluteRoot, path)
  const child = relative(absoluteRoot, absolutePath)
  if (!child || child === ".." || child.startsWith(`..${sep}`)) {
    throw assetError(appId, path, "InvalidPath", "Asset path escapes its configured directory")
  }
  return absolutePath
}

const assetError = (
  appId: string,
  path: string,
  reason: AppAssetError["reason"],
  cause: unknown,
): AppAssetError =>
  new AppAssetError({
    appId,
    path,
    reason,
    message: cause instanceof Error ? cause.message : String(cause),
  })

const isNotFound = (cause: unknown): boolean =>
  typeof cause === "object" && cause !== null && "code" in cause && cause.code === "ENOENT"
