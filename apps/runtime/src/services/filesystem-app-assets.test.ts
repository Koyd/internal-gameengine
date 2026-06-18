import { AppAssets, runAppAssetsConformance } from "@framework/runtime-domain"
import { Effect } from "effect"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { describe, it } from "vite-plus/test"
import { FileSystemAppAssets } from "./filesystem-app-assets.ts"

describe("FileSystemAppAssets", () => {
  it("satisfies the portable app-assets contract", async () => {
    const root = await mkdtemp(join(tmpdir(), "app-assets-"))
    const sourceDirectory = join(root, "source")
    const layer = FileSystemAppAssets.layer({
      cacheDirectory: join(root, "cache"),
      appId: "example",
      sourceDirectory,
    })
    const assets = await Effect.runPromise(AppAssets.pipe(Effect.provide(layer)))

    try {
      await runAppAssetsConformance({
        assets,
        appId: "example",
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
