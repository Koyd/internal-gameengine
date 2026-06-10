import { Effect } from "effect"
import { describe, expect, it } from "vite-plus/test"
import { UserState } from "./user-state.ts"

describe("UserState.memory", () => {
  it("stores a user setting", async () => {
    const setting = await Effect.runPromise(
      Effect.gen(function* () {
        const state = yield* UserState
        yield* state.set("volume", "0.8")
        return yield* state.get("volume")
      }).pipe(Effect.provide(UserState.memory)),
    )

    expect(setting?.value).toBe("0.8")
  })
})
