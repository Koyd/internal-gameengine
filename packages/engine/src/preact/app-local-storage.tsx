import { createContext, type ComponentChildren } from "preact"
import { useContext } from "preact/hooks"
import type { AppLocalStorage, AppStorageCollection } from "../local-storage.ts"

const AppLocalStorageContext = createContext<AppLocalStorage | null>(null)

export interface AppLocalStorageProviderProps {
  readonly children: ComponentChildren
  readonly storage: AppLocalStorage
}

export function AppLocalStorageProvider({ children, storage }: AppLocalStorageProviderProps) {
  return (
    <AppLocalStorageContext.Provider value={storage}>{children}</AppLocalStorageContext.Provider>
  )
}

export const useAppLocalStorage = (): AppLocalStorage => {
  const storage = useContext(AppLocalStorageContext)
  if (!storage) throw new Error("AppLocalStorageProvider is missing")
  return storage
}

export const useAppStorageCollection = (name: string): AppStorageCollection =>
  useAppLocalStorage().collection(name)
