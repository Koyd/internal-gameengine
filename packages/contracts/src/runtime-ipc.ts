import { Schema } from "effect"
import { GameAssetError } from "./runtime-rpcs.ts"

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
    _tag: Schema.Literal("ListGameStorageEntries"),
    gameId: Schema.NonEmptyString,
    collection: Schema.NonEmptyString,
  }),
  Schema.Struct({
    _tag: Schema.Literal("AppendGameStorageEntry"),
    gameId: Schema.NonEmptyString,
    collection: Schema.NonEmptyString,
    value: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal("ResolveGameAsset"),
    gameId: Schema.NonEmptyString,
    path: Schema.NonEmptyString,
  }),
)

export type RuntimeIpcRequest = typeof RuntimeIpcRequest.Type

export class RuntimeIpcFailure extends Schema.Class<RuntimeIpcFailure>("RuntimeIpcFailure")({
  _tag: Schema.Literal("RuntimeIpcFailure"),
  error: GameAssetError,
}) {}

export interface RuntimeIpc {
  readonly invoke: (request: RuntimeIpcRequest) => Promise<unknown>
}
