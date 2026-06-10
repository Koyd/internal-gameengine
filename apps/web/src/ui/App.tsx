import { ExampleGameApp } from "@internal/example-game/react"
import { exampleGameConfig } from "@internal/example-game/config"
import { GameAssetsProvider, GameLocalStorageProvider } from "@internal/engine"
import { useEffect, useMemo } from "react"
import { createRuntimeGameAssets, createRuntimeGameLocalStorage } from "../effect/runtime.ts"

export function App() {
  const assets = useMemo(() => createRuntimeGameAssets(exampleGameConfig), [])
  const storage = useMemo(() => createRuntimeGameLocalStorage(exampleGameConfig), [])

  useEffect(() => {
    document.title = exampleGameConfig.title
  }, [])

  return (
    <GameAssetsProvider assets={assets}>
      <GameLocalStorageProvider storage={storage}>
        <ExampleGameApp />
      </GameLocalStorageProvider>
    </GameAssetsProvider>
  )
}
