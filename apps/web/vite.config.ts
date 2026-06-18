import react from "@vitejs/plugin-react"
import { defineConfig } from "vite-plus"

const runtimeOrigin = `http://localhost:${process.env["GAME_ENGINE_RUNTIME_PORT"] ?? "8787"}`

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    proxy: {
      "^/(game-assets|rpc)": runtimeOrigin,
    },
  },
  preview: {
    proxy: {
      "^/(game-assets|rpc)": runtimeOrigin,
    },
  },
})
