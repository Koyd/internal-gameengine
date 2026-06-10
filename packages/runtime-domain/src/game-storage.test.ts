import { Effect } from "effect"
import { describe, expect, it } from "vite-plus/test"
import { GameStorage } from "./game-storage.ts"

describe("GameStorage.memory", () => {
  it("isolates entries by game and collection", async () => {
    const entries = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* GameStorage
        yield* storage.append("example", "labels", "first")
        yield* storage.append("other", "labels", "hidden")
        return yield* storage.list("example", "labels")
      }).pipe(Effect.provide(GameStorage.memory)),
    )

    expect(entries.map((entry) => entry.value)).toEqual(["first"])
  })
})
