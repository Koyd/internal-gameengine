import { createContext, type ReactNode, useContext } from "react"
import type { GameAssets } from "../assets.ts"

const GameAssetsContext = createContext<GameAssets | null>(null)

export interface GameAssetsProviderProps {
  readonly assets: GameAssets
  readonly children: ReactNode
}

export function GameAssetsProvider({ assets, children }: GameAssetsProviderProps) {
  return <GameAssetsContext.Provider value={assets}>{children}</GameAssetsContext.Provider>
}

export const useGameAssets = (): GameAssets => {
  const assets = useContext(GameAssetsContext)
  if (!assets) throw new Error("GameAssetsProvider is missing")
  return assets
}
