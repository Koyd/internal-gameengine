import { Effect } from "effect"
import { describe, expect, it } from "vite-plus/test"
import { AppStorage } from "./app-storage.ts"

describe("AppStorage.memory", () => {
  it("isolates entries by app and collection", async () => {
    const entries = await Effect.runPromise(
      Effect.gen(function* () {
        const storage = yield* AppStorage
        yield* storage.append("example", "labels", "first")
        yield* storage.append("other", "labels", "hidden")
        return yield* storage.list("example", "labels")
      }).pipe(Effect.provide(AppStorage.memory)),
    )

    expect(entries.map((entry) => entry.value)).toEqual(["first"])
  })
})
