import { HttpLayerRouter, HttpRouter, HttpServerResponse } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import { RpcSerialization, RpcServer } from "@effect/rpc"
import { RuntimeRpcs } from "@internal/contracts"
import {
  GameAssets,
  gameAssetErrorStatus,
  gameAssetMatchesVersion,
  gameAssetResponseHeaders,
  RuntimeHandlers,
} from "@internal/runtime-domain"
import { Effect, Layer } from "effect"
import { createServer } from "node:http"

const runtimePort = Number(process.env["GAME_ENGINE_RUNTIME_PORT"] ?? 8787)

const RpcRoute = RpcServer.layerHttpRouter({
  group: RuntimeRpcs,
  path: "/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(RuntimeHandlers),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(HttpLayerRouter.cors()),
)

const AssetRoute = HttpLayerRouter.add("GET", "/game-assets/:gameId/*", (request) =>
  Effect.gen(function* () {
    const params = yield* HttpRouter.params
    const gameAssets = yield* GameAssets
    const opened = yield* gameAssets.open(
      params["gameId"] ?? "",
      params["*"] ?? "",
      request.headers["range"],
    )
    if (!opened.range && gameAssetMatchesVersion(opened.asset, request.headers["if-none-match"])) {
      return HttpServerResponse.empty({
        headers: gameAssetResponseHeaders(opened.asset),
        status: 304,
      })
    }
    return HttpServerResponse.stream(opened.stream, {
      headers: gameAssetResponseHeaders(opened.asset, opened.range),
      status: opened.range ? 206 : 200,
    })
  }).pipe(
    Effect.catchAll((error) =>
      Effect.succeed(
        HttpServerResponse.text(error.message, {
          headers: {
            "accept-ranges": "bytes",
            "cache-control": "no-cache",
          },
          status: gameAssetErrorStatus(error),
        }),
      ),
    ),
  ),
)

export const RuntimeServer = {
  layer: HttpLayerRouter.serve(Layer.merge(RpcRoute, AssetRoute)).pipe(
    Layer.provide(NodeHttpServer.layer(createServer, { port: runtimePort })),
  ),
}
