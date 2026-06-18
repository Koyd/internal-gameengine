import { exampleAppConfig } from "../projects/example/src/config.ts"
import type { AppConfig } from "@framework/engine/config"
import { spawnSync } from "node:child_process"
import { cpSync, rmSync } from "node:fs"
import { resolve } from "node:path"

const action = process.argv[2]
const config: AppConfig = exampleAppConfig

if (action === "primary") {
  const task =
    config.target === "electron"
      ? "example:build-desktop"
      : config.target === "web"
        ? "example:build-web"
        : config.target === "android"
          ? "example:build-android"
          : config.target === "ios"
            ? "example:build-ios"
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

if (action === "assert-mobile") {
  assertMobile(config, process.argv[3], `example:build-${process.argv[3] ?? "<missing>"}`)
  process.exit(0)
}

if (action === "prepare-mobile-assets") {
  assertMobile(config, process.argv[3], `example:build-${process.argv[3] ?? "<missing>"}`)
  copyMobileAssets(config)
  process.exit(0)
}

if (action === "package-android") {
  assertMobile(config, "android", "Android packaging")

  const result = spawnSync("./gradlew", ["assembleRelease"], {
    cwd: new URL("../android", import.meta.url),
    stdio: "inherit",
  })
  process.exit(result.status ?? 1)
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

function assertMobile(config: AppConfig, platform: string | undefined, operation: string): void {
  if (platform !== "android" && platform !== "ios") {
    throw new Error(`Unknown mobile platform "${platform ?? "<missing>"}"`)
  }

  if (config.target !== platform) {
    throw new Error(
      `${operation} requires target "${platform}"; config target is "${config.target}"`,
    )
  }
}

function copyMobileAssets(config: AppConfig): void {
  const workspace = resolve(import.meta.dirname, "..")
  const source = resolve(workspace, config.assetsDirectory)
  const destination = resolve(workspace, "apps/web/dist/app-assets", config.id)
  rmSync(destination, { force: true, recursive: true })
  cpSync(source, destination, { recursive: true })
}
