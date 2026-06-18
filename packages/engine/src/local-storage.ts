export interface AppStorageRecord {
  readonly id: number
  readonly value: string
  readonly createdAt: string
}

export interface AppStorageCollection {
  readonly list: () => Promise<ReadonlyArray<AppStorageRecord>>
  readonly append: (value: string) => Promise<AppStorageRecord>
}

export interface AppLocalStorage {
  readonly collection: (name: string) => AppStorageCollection
}

export interface AppStorageTransport {
  readonly list: (appId: string, collection: string) => Promise<ReadonlyArray<AppStorageRecord>>
  readonly append: (appId: string, collection: string, value: string) => Promise<AppStorageRecord>
}

export const createAppLocalStorage = (
  appId: string,
  transport: AppStorageTransport,
): AppLocalStorage => ({
  collection: (name) => ({
    list: () => transport.list(appId, name),
    append: (value) => transport.append(appId, name, value),
  }),
})
