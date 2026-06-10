import { builtinModules } from "node:module"
import { resolve } from "node:path"
import { defineConfig } from "vite-plus"

const external = [
  "electron",
  ...builtinModules,
  ...builtinModules.map((module) => `node:${module}`),
]

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: {
        main: resolve(import.meta.dirname, "src/main.ts"),
        preload: resolve(import.meta.dirname, "src/preload.ts"),
      },
      formats: ["cjs"],
    },
    rolldownOptions: {
      external,
      output: {
        entryFileNames: "[name].cjs",
      },
    },
  },
})
