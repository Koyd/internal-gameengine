import { Rpc, RpcGroup } from "@effect/rpc"
import { Schema } from "effect"

export class UserSetting extends Schema.Class<UserSetting>("UserSetting")({
  key: Schema.NonEmptyString,
  value: Schema.String,
  updatedAt: Schema.String,
}) {}

export class AppStorageEntry extends Schema.Class<AppStorageEntry>("AppStorageEntry")({
  id: Schema.Number,
  appId: Schema.NonEmptyString,
  collection: Schema.NonEmptyString,
  value: Schema.String,
  createdAt: Schema.String,
}) {}

export class ResolvedAppAsset extends Schema.Class<ResolvedAppAsset>("ResolvedAppAsset")({
  contentType: Schema.NonEmptyString,
  appId: Schema.NonEmptyString,
  path: Schema.NonEmptyString,
  size: Schema.Number,
  version: Schema.NonEmptyString,
}) {}

export class AppAssetError extends Schema.TaggedError<AppAssetError>()("AppAssetError", {
  appId: Schema.String,
  message: Schema.String,
  path: Schema.String,
  reason: Schema.Literal(
    "UnknownApp",
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
  Rpc.make("ListAppStorageEntries", {
    payload: {
      appId: Schema.NonEmptyString,
      collection: Schema.NonEmptyString,
    },
    success: Schema.Array(AppStorageEntry),
  }),
  Rpc.make("AppendAppStorageEntry", {
    payload: {
      appId: Schema.NonEmptyString,
      collection: Schema.NonEmptyString,
      value: Schema.String,
    },
    success: AppStorageEntry,
  }),
  Rpc.make("ResolveAppAsset", {
    payload: {
      appId: Schema.NonEmptyString,
      path: Schema.NonEmptyString,
    },
    error: AppAssetError,
    success: ResolvedAppAsset,
  }),
) {}
