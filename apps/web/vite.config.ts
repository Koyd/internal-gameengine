import preact from "@preact/preset-vite"
import { defineConfig } from "vite-plus"

const runtimeOrigin = `http://localhost:${process.env["FRAMEWORK_RUNTIME_PORT"] ?? "8787"}`

export default defineConfig({
  base: "./",
  plugins: [preact()],
  server: {
    proxy: {
      "^/(app-assets|rpc)": runtimeOrigin,
    },
  },
  preview: {
    proxy: {
      "^/(app-assets|rpc)": runtimeOrigin,
    },
  },
})
