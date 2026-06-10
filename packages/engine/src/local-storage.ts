export interface GameStorageRecord {
  readonly id: number
  readonly value: string
  readonly createdAt: string
}

export interface GameStorageCollection {
  readonly list: () => Promise<ReadonlyArray<GameStorageRecord>>
  readonly append: (value: string) => Promise<GameStorageRecord>
}

export interface GameLocalStorage {
  readonly collection: (name: string) => GameStorageCollection
}

export interface GameStorageTransport {
  readonly list: (gameId: string, collection: string) => Promise<ReadonlyArray<GameStorageRecord>>
  readonly append: (gameId: string, collection: string, value: string) => Promise<GameStorageRecord>
}

export const createGameLocalStorage = (
  gameId: string,
  transport: GameStorageTransport,
): GameLocalStorage => ({
  collection: (name) => ({
    list: () => transport.list(gameId, name),
    append: (value) => transport.append(gameId, name, value),
  }),
})
