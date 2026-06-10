import { GameAssetError } from "@internal/contracts"
import { Effect, Stream } from "effect"
import {
  gameAssetMatchesVersion,
  gameAssetResponseHeaders,
  type GameAssetsShape,
} from "./game-assets.ts"

export interface GameAssetsConformanceFixture {
  readonly assets: GameAssetsShape
  readonly gameId: string
  readonly writeSource: (path: string, contents: string) => Promise<void>
}

export const runGameAssetsConformance = async ({
  assets,
  gameId,
  writeSource,
}: GameAssetsConformanceFixture): Promise<void> => {
  await writeSource("models/ship.gltf", "model-v1")
  await writeSource("models/data.unknown", "opaque")

  const first = await Effect.runPromise(assets.resolve(gameId, "://assets/models/ship.gltf"))
  assert(first.contentType === "model/gltf+json", "GLTF MIME type must be portable")
  assert(first.size === 8, "Resolved size must describe the source")
  assert(
    gameAssetMatchesVersion(first, `"${first.version}"`),
    "Versions must support conditional cache revalidation",
  )

  const full = await Effect.runPromise(assets.open(gameId, "://assets/models/ship.gltf"))
  assert((await read(full.stream)) === "model-v1", "Full asset streams must contain the source")

  const partial = await Effect.runPromise(
    assets.open(gameId, "://assets/models/ship.gltf", "bytes=1-3"),
  )
  assert(partial.range?.start === 1 && partial.range.end === 3, "Ranges must be normalized")
  const partialHeaders = gameAssetResponseHeaders(partial.asset, partial.range)
  assert(partialHeaders["accept-ranges"] === "bytes", "Responses must advertise byte ranges")
  assert(partialHeaders["content-range"] === "bytes 1-3/8", "Partial responses need content ranges")
  assert((await read(partial.stream)) === "ode", "Range streams must contain only requested bytes")

  const suffix = await Effect.runPromise(
    assets.open(gameId, "://assets/models/ship.gltf", "bytes=-2"),
  )
  assert((await read(suffix.stream)) === "v1", "Suffix ranges must be supported")

  const opaque = await Effect.runPromise(assets.resolve(gameId, "://assets/models/data.unknown"))
  assert(
    opaque.contentType === "application/octet-stream",
    "Unknown extensions must use the binary MIME fallback",
  )

  await expectReason(
    assets.open(gameId, "://assets/models/ship.gltf", "bytes=99-100"),
    "RangeNotSatisfiable",
  )
  await expectReason(assets.resolve(gameId, "://assets/../outside.gltf"), "InvalidPath")
  await expectReason(assets.resolve(gameId, "://assets/models/missing.gltf"), "NotFound")
  await expectReason(assets.resolve("unknown-game", "://assets/models/ship.gltf"), "UnknownGame")

  await writeSource("models/ship.gltf", "model-v2-longer")
  const refreshed = await Effect.runPromise(assets.open(gameId, "://assets/models/ship.gltf"))
  assert(refreshed.asset.version !== first.version, "Source changes must invalidate the cache")
  assert(
    (await read(refreshed.stream)) === "model-v2-longer",
    "Invalidated cache entries must stream refreshed content",
  )
}

const read = (stream: Stream.Stream<Uint8Array, GameAssetError>): Promise<string> =>
  Effect.runPromise(
    stream.pipe(
      Stream.runFold(new Uint8Array(), (output, chunk) => {
        const combined = new Uint8Array(output.length + chunk.length)
        combined.set(output)
        combined.set(chunk, output.length)
        return combined
      }),
      Effect.map((bytes) => new TextDecoder().decode(bytes)),
    ),
  )

const expectReason = async (
  effect: Effect.Effect<unknown, GameAssetError>,
  reason: GameAssetError["reason"],
): Promise<void> => {
  const error = await Effect.runPromise(Effect.flip(effect))
  assert(error.reason === reason, `Expected ${reason}, received ${error.reason}`)
}

const assert: (condition: boolean, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message)
}
