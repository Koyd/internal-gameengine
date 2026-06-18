import { defineAppConfig } from "@framework/engine/config"

export const exampleAppConfig = defineAppConfig({
  assetsDirectory: "projects/example/assets",
  id: "example",
  target: "android",
  title: "Framework Example",
})
