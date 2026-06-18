import { defineGameConfig } from "@internal/engine/config"

export const exampleGameConfig = defineGameConfig({
  assetsDirectory: "projects/example/assets",
  id: "example",
  target: "electron",
  title: "Internal Game Engine Example",
})
