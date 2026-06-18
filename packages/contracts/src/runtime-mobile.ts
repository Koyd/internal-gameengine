import { Schema } from "effect"
import type { RuntimeIpcRequest } from "./runtime-ipc.ts"
import { AppAssetError } from "./runtime-rpcs.ts"

export const RuntimeMobilePlatform = Schema.Literal("android", "ios")
export type RuntimeMobilePlatform = typeof RuntimeMobilePlatform.Type

export type RuntimeMobileRequest = RuntimeIpcRequest

export interface RuntimeMobileInvokeOptions {
  readonly request: RuntimeMobileRequest
}

export class RuntimeMobileFailure extends Schema.Class<RuntimeMobileFailure>(
  "RuntimeMobileFailure",
)({
  _tag: Schema.Literal("RuntimeMobileFailure"),
  error: AppAssetError,
}) {}

export interface RuntimeMobile {
  readonly invoke: (options: RuntimeMobileInvokeOptions) => Promise<unknown>
}
