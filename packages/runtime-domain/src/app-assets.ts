import { AppAssetError, type ResolvedAppAsset } from "@framework/contracts"
import { Context, Effect, Stream } from "effect"

export interface AppAssetRange {
  readonly end: number
  readonly length: number
  readonly start: number
}

export interface OpenAppAsset {
  readonly asset: ResolvedAppAsset
  readonly range?: AppAssetRange
  readonly stream: Stream.Stream<Uint8Array, AppAssetError>
}

export interface AppAssetsShape {
  readonly open: (
    appId: string,
    path: string,
    range?: string,
  ) => Effect.Effect<OpenAppAsset, AppAssetError>
  readonly resolve: (appId: string, path: string) => Effect.Effect<ResolvedAppAsset, AppAssetError>
}

export class AppAssets extends Context.Tag("@framework/runtime-domain/AppAssets")<
  AppAssets,
  AppAssetsShape
>() {}

export const appAssetContentType = (path: string): string => {
  const extension = path.split(".").at(-1)?.toLowerCase()
  return contentTypes[extension ?? ""] ?? "application/octet-stream"
}

export const parseAppAssetRange = (
  appId: string,
  path: string,
  size: number,
  header?: string,
): Effect.Effect<AppAssetRange | undefined, AppAssetError> =>
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
      new AppAssetError({
        appId,
        path,
        reason: "RangeNotSatisfiable",
        message: cause instanceof Error ? cause.message : String(cause),
      }),
  })

export const appAssetErrorStatus = (error: AppAssetError): number => {
  if (error.reason === "InvalidPath") return 400
  if (error.reason === "RangeNotSatisfiable") return 416
  if (error.reason === "Io") return 500
  return 404
}

export const appAssetResponseHeaders = (
  asset: ResolvedAppAsset,
  range?: AppAssetRange,
): Readonly<Record<string, string>> => ({
  "accept-ranges": "bytes",
  "cache-control": "no-cache",
  "content-length": String(range?.length ?? asset.size),
  "content-type": asset.contentType,
  etag: `"${asset.version}"`,
  ...(range ? { "content-range": `bytes ${range.start}-${range.end}/${asset.size}` } : {}),
})

export const appAssetMatchesVersion = (asset: ResolvedAppAsset, ifNoneMatch?: string): boolean =>
  ifNoneMatch?.split(",").some((value) => value.trim() === `"${asset.version}"`) ?? false

const contentTypes: Readonly<Record<string, string>> = {
  avif: "image/avif",
  bin: "application/octet-stream",
  gdshader: "text/plain; charset=utf-8",
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
