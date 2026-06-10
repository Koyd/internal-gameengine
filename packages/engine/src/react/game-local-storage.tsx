import { createContext, type ReactNode, useContext } from "react"
import type { GameLocalStorage, GameStorageCollection } from "../local-storage.ts"

const GameLocalStorageContext = createContext<GameLocalStorage | null>(null)

export interface GameLocalStorageProviderProps {
  readonly children: ReactNode
  readonly storage: GameLocalStorage
}

export function GameLocalStorageProvider({ children, storage }: GameLocalStorageProviderProps) {
  return (
    <GameLocalStorageContext.Provider value={storage}>{children}</GameLocalStorageContext.Provider>
  )
}

export const useGameLocalStorage = (): GameLocalStorage => {
  const storage = useContext(GameLocalStorageContext)
  if (!storage) throw new Error("GameLocalStorageProvider is missing")
  return storage
}

export const useGameStorageCollection = (name: string): GameStorageCollection =>
  useGameLocalStorage().collection(name)
