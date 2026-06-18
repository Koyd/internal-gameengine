import {
  HttpLayerRouter,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import { RpcSerialization, RpcServer } from "@effect/rpc"
import {
  RuntimeIpcRequest,
  RuntimeMobileFailure,
  RuntimeMobilePlatform,
  RuntimeRpcs,
} from "@framework/contracts"
import {
  AppAssets,
  appAssetErrorStatus,
  appAssetMatchesVersion,
  appAssetResponseHeaders,
  handleRuntimeRequest,
  RuntimeHandlers,
} from "@framework/runtime-domain"
import { Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

const runtimePort = Number(process.env["FRAMEWORK_RUNTIME_PORT"] ?? 8787)

const RpcRoute = RpcServer.layerHttpRouter({
  group: RuntimeRpcs,
  path: "/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(RuntimeHandlers),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(HttpLayerRouter.cors()),
)

const AssetRoute = HttpLayerRouter.add("GET", "/app-assets/:appId/*", (request) =>
  Effect.gen(function* () {
    const params = yield* HttpRouter.params
    const appAssets = yield* AppAssets
    const opened = yield* appAssets.open(
      params["appId"] ?? "",
      params["*"] ?? "",
      request.headers["range"],
    )
    if (!opened.range && appAssetMatchesVersion(opened.asset, request.headers["if-none-match"])) {
      return HttpServerResponse.empty({
        headers: appAssetResponseHeaders(opened.asset),
        status: 304,
      })
    }
    return HttpServerResponse.stream(opened.stream, {
      headers: appAssetResponseHeaders(opened.asset, opened.range),
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
          status: appAssetErrorStatus(error),
        }),
      ),
    ),
  ),
)

const MobileRoute = HttpLayerRouter.add("POST", "/mobile/:platform", () =>
  Effect.gen(function* () {
    const params = yield* HttpRouter.params
    const platform = yield* Schema.decodeUnknown(RuntimeMobilePlatform)(params["platform"])
    const request = yield* HttpServerRequest.schemaBodyJson(RuntimeIpcRequest)
    const result = yield* handleRuntimeRequest(request, `mobile:${platform}`).pipe(
      Effect.catchTag("AppAssetError", (error) =>
        Effect.succeed(new RuntimeMobileFailure({ _tag: "RuntimeMobileFailure", error })),
      ),
    )

    return HttpServerResponse.unsafeJson(result)
  }).pipe(
    Effect.catchAll((cause) =>
      Effect.succeed(
        HttpServerResponse.text(cause instanceof Error ? cause.message : String(cause), {
          status: 400,
        }),
      ),
    ),
  ),
)

export const RuntimeServer = {
  layer: HttpLayerRouter.serve(Layer.mergeAll(RpcRoute, AssetRoute, MobileRoute)).pipe(
    Layer.provide(NodeHttpServer.layer(createServer, { port: runtimePort })),
  ),
}
