import type { RuntimeIpc, RuntimeIpcRequest } from "@internal/contracts"
import { contextBridge, ipcRenderer } from "electron"

const runtimeIpc: RuntimeIpc = {
  invoke: (request: RuntimeIpcRequest) => ipcRenderer.invoke("game-engine:runtime", request),
}

contextBridge.exposeInMainWorld("gameEngineDesktop", runtimeIpc)
