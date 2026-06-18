import { exampleAppConfig } from "../projects/example/src/config.ts"
import type { AppConfig } from "@framework/engine/config"
import { spawnSync } from "node:child_process"

const action = process.argv[2]
const config: AppConfig = exampleAppConfig

if (action === "primary") {
  const task =
    config.target === "electron"
      ? "example:build-desktop"
      : config.target === "web"
        ? "example:build-web"
        : undefined

  if (!task) {
    throw new Error(`No build implementation exists for target "${config.target}"`)
  }

  const result = spawnSync("vp", ["run", task], { stdio: "inherit" })
  process.exit(result.status ?? 1)
}

if (action === "assert-electron") {
  assertElectron(config, "example:build-desktop")
  process.exit(0)
}

if (action === "package-electron") {
  assertElectron(config, "Desktop packaging")

  const result = spawnSync(
    "electron-builder",
    [
      "--config",
      "electron-builder.yml",
      "--linux",
      "AppImage",
      "--config.productName",
      exampleAppConfig.title,
    ],
    {
      cwd: new URL("../apps/desktop", import.meta.url),
      stdio: "inherit",
    },
  )
  process.exit(result.status ?? 1)
}

throw new Error(`Unknown example build action: ${action ?? "<missing>"}`)

function assertElectron(config: AppConfig, operation: string): void {
  if (config.target !== "electron") {
    throw new Error(`${operation} requires target "electron"; config target is "${config.target}"`)
  }
}
