import { createContext, type ComponentChildren } from "preact"
import { useContext } from "preact/hooks"
import type { AppAssets } from "../assets.ts"

const AppAssetsContext = createContext<AppAssets | null>(null)

export interface AppAssetsProviderProps {
  readonly assets: AppAssets
  readonly children: ComponentChildren
}

export function AppAssetsProvider({ assets, children }: AppAssetsProviderProps) {
  return <AppAssetsContext.Provider value={assets}>{children}</AppAssetsContext.Provider>
}

export const useAppAssets = (): AppAssets => {
  const assets = useContext(AppAssetsContext)
  if (!assets) throw new Error("AppAssetsProvider is missing")
  return assets
}
