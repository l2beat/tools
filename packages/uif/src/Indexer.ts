export interface UpdateEvent {
  type: 'update'
  height: number
}

export interface Indexer {
  subscribe(child: Indexer): void
  notifyReady(child: Indexer): void
  notifyUpdate(parent: Indexer, safeHeight: number | undefined): void
  start(): Promise<void>
}
