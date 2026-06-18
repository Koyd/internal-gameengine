import { ExampleApp } from "@framework/example-app/preact"
import { exampleAppConfig } from "@framework/example-app/config"
import { AppAssetsProvider, AppLocalStorageProvider } from "@framework/engine"
import { useEffect, useMemo } from "preact/hooks"
import { createRuntimeAppAssets, createRuntimeAppLocalStorage } from "../effect/runtime.ts"

export function App() {
  const assets = useMemo(() => createRuntimeAppAssets(exampleAppConfig), [])
  const storage = useMemo(() => createRuntimeAppLocalStorage(exampleAppConfig), [])

  useEffect(() => {
    document.title = exampleAppConfig.title
  }, [])

  return (
    <AppAssetsProvider assets={assets}>
      <AppLocalStorageProvider storage={storage}>
        <ExampleApp />
      </AppLocalStorageProvider>
    </AppAssetsProvider>
  )
}
