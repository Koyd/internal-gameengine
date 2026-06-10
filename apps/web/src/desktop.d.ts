import type { RuntimeIpc } from "@internal/contracts"

declare global {
  interface Window {
    readonly gameEngineDesktop?: RuntimeIpc
  }
}

export {}
