import { GameAssetError, type ResolvedGameAsset } from "@internal/contracts"
import { Context, Effect, Stream } from "effect"

export interface GameAssetRange {
  readonly end: number
  readonly length: number
  readonly start: number
}

export interface OpenGameAsset {
  readonly asset: ResolvedGameAsset
  readonly range?: GameAssetRange
  readonly stream: Stream.Stream<Uint8Array, GameAssetError>
}

export interface GameAssetsShape {
  readonly open: (
    gameId: string,
    path: string,
    range?: string,
  ) => Effect.Effect<OpenGameAsset, GameAssetError>
  readonly resolve: (
    gameId: string,
    path: string,
  ) => Effect.Effect<ResolvedGameAsset, GameAssetError>
}

export class GameAssets extends Context.Tag("@internal/runtime-domain/GameAssets")<
  GameAssets,
  GameAssetsShape
>() {}

export const gameAssetContentType = (path: string): string => {
  const extension = path.split(".").at(-1)?.toLowerCase()
  return contentTypes[extension ?? ""] ?? "application/octet-stream"
}

export const parseGameAssetRange = (
  gameId: string,
  path: string,
  size: number,
  header?: string,
): Effect.Effect<GameAssetRange | undefined, GameAssetError> =>
  Effect.try({
    try: () => {
      if (!header) return undefined
      const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
      if (!match || header.includes(",")) throw new Error("Only one byte range is supported")

      const [, rawStart = "", rawEnd = ""] = match
      if (!rawStart && !rawEnd) throw new Error("Byte range is empty")

      const start = rawStart ? Number(rawStart) : Math.max(0, size - Number(rawEnd))
      const end = rawEnd && rawStart ? Math.min(size - 1, Number(rawEnd)) : size - 1
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        end < start ||
        start >= size
      ) {
        throw new Error("Byte range is outside the asset")
      }
      return { end, length: end - start + 1, start }
    },
    catch: (cause) =>
      new GameAssetError({
        gameId,
        path,
        reason: "RangeNotSatisfiable",
        message: cause instanceof Error ? cause.message : String(cause),
      }),
  })

export const gameAssetErrorStatus = (error: GameAssetError): number => {
  if (error.reason === "InvalidPath") return 400
  if (error.reason === "RangeNotSatisfiable") return 416
  if (error.reason === "Io") return 500
  return 404
}

export const gameAssetResponseHeaders = (
  asset: ResolvedGameAsset,
  range?: GameAssetRange,
): Readonly<Record<string, string>> => ({
  "accept-ranges": "bytes",
  "cache-control": "no-cache",
  "content-length": String(range?.length ?? asset.size),
  "content-type": asset.contentType,
  etag: `"${asset.version}"`,
  ...(range ? { "content-range": `bytes ${range.start}-${range.end}/${asset.size}` } : {}),
})

export const gameAssetMatchesVersion = (asset: ResolvedGameAsset, ifNoneMatch?: string): boolean =>
  ifNoneMatch?.split(",").some((value) => value.trim() === `"${asset.version}"`) ?? false

const contentTypes: Readonly<Record<string, string>> = {
  avif: "image/avif",
  bin: "application/octet-stream",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json",
  ktx2: "image/ktx2",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  ogg: "audio/ogg",
  png: "image/png",
  webm: "video/webm",
  webp: "image/webp",
  wav: "audio/wav",
}
