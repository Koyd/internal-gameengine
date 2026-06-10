import { GameAssets, runGameAssetsConformance } from "@internal/runtime-domain"
import { Effect } from "effect"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { describe, it } from "vite-plus/test"
import { FileSystemGameAssets } from "./filesystem-game-assets.ts"

describe("FileSystemGameAssets", () => {
  it("satisfies the portable game-assets contract", async () => {
    const root = await mkdtemp(join(tmpdir(), "game-assets-"))
    const sourceDirectory = join(root, "source")
    const layer = FileSystemGameAssets.layer({
      cacheDirectory: join(root, "cache"),
      gameId: "example",
      sourceDirectory,
    })
    const assets = await Effect.runPromise(GameAssets.pipe(Effect.provide(layer)))

    try {
      await runGameAssetsConformance({
        assets,
        gameId: "example",
        writeSource: async (path, contents) => {
          const destination = join(sourceDirectory, path)
          await mkdir(dirname(destination), { recursive: true })
          await writeFile(destination, contents)
        },
      })
    } finally {
      await rm(root, { recursive: true })
    }
  })
})
