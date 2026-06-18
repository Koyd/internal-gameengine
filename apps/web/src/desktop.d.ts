import type { RuntimeIpc } from "@framework/contracts"

declare global {
  interface Window {
    readonly frameworkDesktop?: RuntimeIpc
  }
}

export {}
