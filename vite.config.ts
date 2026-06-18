import { defineConfig } from "vite-plus"

export default defineConfig({
  lint: {
    plugins: ["typescript"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        files: ["**/*.test.ts", "**/*.test.tsx"],
        plugins: ["typescript", "vitest"],
      },
    ],
  },
  fmt: {
    semi: false,
    singleQuote: false,
  },
  run: {
    tasks: {
      "example:build": {
        command: "node --experimental-strip-types scripts/example-build.ts primary",
        cache: false,
      },
      "example:build-web": {
        command: "vp build apps/web",
        input: [
          "apps/**",
          "packages/**",
          "projects/**",
          "package.json",
          "tsconfig.base.json",
          "vite.config.ts",
          "!apps/web/dist/**",
        ],
        output: ["apps/web/dist/**"],
      },
      "example:run": {
        command:
          "vp run --parallel --filter @framework/runtime --filter @framework/web example:serve",
        dependsOn: ["example:build-web"],
        cache: false,
      },
      "example:build-desktop": {
        command: [
          "node --experimental-strip-types scripts/example-build.ts assert-electron",
          "vp build apps/web --mode desktop",
          "vp build apps/desktop",
          "vp run @framework/desktop-app#pack",
        ],
        cache: false,
      },
    },
  },
})
