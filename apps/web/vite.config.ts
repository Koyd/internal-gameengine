import react from "@vitejs/plugin-react"
import { defineConfig } from "vite-plus"

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    proxy: {
      "^/(game-assets|rpc)": "http://localhost:8787",
    },
  },
  preview: {
    proxy: {
      "^/(game-assets|rpc)": "http://localhost:8787",
    },
  },
})
