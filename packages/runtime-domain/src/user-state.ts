import { Context, Effect, Layer, Ref } from "effect"
import type { UserSetting } from "@framework/contracts"

export interface UserStateShape {
  readonly get: (key: string) => Effect.Effect<UserSetting | null>
  readonly set: (key: string, value: string) => Effect.Effect<UserSetting>
}

export class UserState extends Context.Tag("@framework/runtime-domain/UserState")<
  UserState,
  UserStateShape
>() {
  static readonly memory = Layer.effect(
    UserState,
    Effect.gen(function* () {
      const values = yield* Ref.make(new Map<string, UserSetting>())

      return UserState.of({
        get: Effect.fn("UserState.get")((key: string) =>
          Ref.get(values).pipe(Effect.map((state) => state.get(key) ?? null)),
        ),
        set: Effect.fn("UserState.set")((key: string, value: string) =>
          Effect.gen(function* () {
            const setting: UserSetting = {
              key,
              value,
              updatedAt: new Date().toISOString(),
            }
            yield* Ref.update(values, (state) => new Map(state).set(key, setting))
            return setting
          }),
        ),
      })
    }),
  )
}
