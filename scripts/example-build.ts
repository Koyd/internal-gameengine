import { exampleGameConfig } from "../projects/example/src/config.ts"
import type { GameConfig } from "@internal/engine/config"
import { spawnSync } from "node:child_process"

const action = process.argv[2]

if (action === "primary") {
  const task =
    exampleGameConfig.target === "electron"
      ? "example:build-desktop"
      : exampleGameConfig.target === "web"
        ? "example:build-web"
        : undefined

  if (!task) {
    throw new Error(`No build implementation exists for target "${exampleGameConfig.target}"`)
  }

  const result = spawnSync("vp", ["run", task], { stdio: "inherit" })
  process.exit(result.status ?? 1)
}

if (action === "assert-electron") {
  assertElectron(exampleGameConfig, "example:build-desktop")
  process.exit(0)
}

if (action === "package-electron") {
  assertElectron(exampleGameConfig, "Desktop packaging")

  const result = spawnSync(
    "electron-builder",
    [
      "--config",
      "electron-builder.yml",
      "--linux",
      "AppImage",
      "--config.productName",
      exampleGameConfig.title,
    ],
    {
      cwd: new URL("../apps/desktop", import.meta.url),
      stdio: "inherit",
    },
  )
  process.exit(result.status ?? 1)
}

throw new Error(`Unknown example build action: ${action ?? "<missing>"}`)

function assertElectron(config: GameConfig, operation: string): void {
  if (config.target !== "electron") {
    throw new Error(`${operation} requires target "electron"; config target is "${config.target}"`)
  }
}
