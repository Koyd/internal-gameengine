import type { RuntimeIpc, RuntimeIpcRequest } from "@framework/contracts"
import { contextBridge, ipcRenderer } from "electron"

const runtimeIpc: RuntimeIpc = {
  invoke: (request: RuntimeIpcRequest) => ipcRenderer.invoke("framework:runtime", request),
}

contextBridge.exposeInMainWorld("frameworkDesktop", runtimeIpc)
