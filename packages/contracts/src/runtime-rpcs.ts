import { Rpc, RpcGroup } from "@effect/rpc"
import { Schema } from "effect"

export class UserSetting extends Schema.Class<UserSetting>("UserSetting")({
  key: Schema.NonEmptyString,
  value: Schema.String,
  updatedAt: Schema.String,
}) {}

export class GameStorageEntry extends Schema.Class<GameStorageEntry>("GameStorageEntry")({
  id: Schema.Number,
  gameId: Schema.NonEmptyString,
  collection: Schema.NonEmptyString,
  value: Schema.String,
  createdAt: Schema.String,
}) {}

export class ResolvedGameAsset extends Schema.Class<ResolvedGameAsset>("ResolvedGameAsset")({
  contentType: Schema.NonEmptyString,
  gameId: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
  size: Schema.Number,
  version: Schema.NonEmptyString,
}) {}

export class GameAssetError extends Schema.TaggedError<GameAssetError>()("GameAssetError", {
  gameId: Schema.String,
  message: Schema.String,
  path: Schema.String,
  reason: Schema.Literal(
    "UnknownGame",
    "InvalidPath",
    "NotFound",
    "NotFile",
    "RangeNotSatisfiable",
    "Io",
  ),
}) {}

export class RuntimeRpcs extends RpcGroup.make(
  Rpc.make("Health", {
    success: Schema.Struct({
      status: Schema.Literal("ok"),
      runtime: Schema.NonEmptyString,
    }),
  }),
  Rpc.make("GetUserSetting", {
    payload: { key: Schema.NonEmptyString },
    success: Schema.NullOr(UserSetting),
  }),
  Rpc.make("SetUserSetting", {
    payload: {
      key: Schema.NonEmptyString,
      value: Schema.String,
    },
    success: UserSetting,
  }),
  Rpc.make("ListGameStorageEntries", {
    payload: {
      gameId: Schema.NonEmptyString,
      collection: Schema.NonEmptyString,
    },
    success: Schema.Array(GameStorageEntry),
  }),
  Rpc.make("AppendGameStorageEntry", {
    payload: {
      gameId: Schema.NonEmptyString,
      collection: Schema.NonEmptyString,
      value: Schema.String,
    },
    success: GameStorageEntry,
  }),
  Rpc.make("ResolveGameAsset", {
    payload: {
      gameId: Schema.NonEmptyString,
      path: Schema.NonEmptyString,
    },
    error: GameAssetError,
    success: ResolvedGameAsset,
  }),
) {}
