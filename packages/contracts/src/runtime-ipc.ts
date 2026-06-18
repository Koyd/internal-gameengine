import { Schema } from "effect"
import { AppAssetError } from "./runtime-rpcs.ts"

export const RuntimeIpcRequest = Schema.Union(
  Schema.Struct({ _tag: Schema.Literal("Health") }),
  Schema.Struct({
    _tag: Schema.Literal("GetUserSetting"),
    key: Schema.NonEmptyString,
  }),
  Schema.Struct({
    _tag: Schema.Literal("SetUserSetting"),
    key: Schema.NonEmptyString,
    value: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("ListAppStorageEntries"),
    appId: Schema.NonEmptyString,
    collection: Schema.NonEmptyString,
  }),
  Schema.Struct({
    _tag: Schema.Literal("AppendAppStorageEntry"),
    appId: Schema.NonEmptyString,
    collection: Schema.NonEmptyString,
    value: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("ResolveAppAsset"),
    appId: Schema.NonEmptyString,
    path: Schema.NonEmptyString,
  }),
)

export type RuntimeIpcRequest = typeof RuntimeIpcRequest.Type

export class RuntimeIpcFailure extends Schema.Class<RuntimeIpcFailure>("RuntimeIpcFailure")({
  _tag: Schema.Literal("RuntimeIpcFailure"),
  error: AppAssetError,
}) {}

export interface RuntimeIpc {
  readonly invoke: (request: RuntimeIpcRequest) => Promise<unknown>
}
