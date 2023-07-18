export interface IndexerState {
  readonly status:
    | 'init'
    | 'idle'
    | 'updating'
    | 'invalidating'
    | 'ticking'
    | 'errored'
  readonly height: number
  readonly targetHeight: number
  // When we change safe height to a lower value we become waiting
  // and we mark all children as not ready
  readonly safeHeight: number
  readonly waiting: boolean
  readonly tickScheduled: boolean
  readonly initializedSelf: boolean
  readonly parents: {
    readonly initialized: boolean
    // When the parent changes safeHeight to a lower value
    // we mark them as waiting and will notify them when we're ready
    readonly safeHeight: number
    readonly waiting: boolean
  }[]
  readonly children: {
    readonly ready: boolean
  }[]
  readonly retryingUpdate: boolean
  readonly retryingInvalidate: boolean
  readonly retryingTick: boolean
}
