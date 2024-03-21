export type IndexerEffect =
  | UpdateEffect
  | InvalidateEffect
  | SetSafeHeightEffect
  | NotifyReadyEffect
  | TickEffect
  | ScheduleRetryUpdateEffect
  | ScheduleRetryInvalidateEffect
  | ScheduleRetryTickEffect

export interface UpdateEffect {
  type: 'Update'
  targetHeight: number
}

export interface InvalidateEffect {
  type: 'Invalidate'
  targetHeight: number | null
}

export interface SetSafeHeightEffect {
  type: 'SetSafeHeight'
  safeHeight: number | null
}

export interface NotifyReadyEffect {
  type: 'NotifyReady'
  parentIndices: number[]
}

export interface TickEffect {
  type: 'Tick'
}

export interface ScheduleRetryUpdateEffect {
  type: 'ScheduleRetryUpdate'
}

export interface ScheduleRetryInvalidateEffect {
  type: 'ScheduleRetryInvalidate'
}

export interface ScheduleRetryTickEffect {
  type: 'ScheduleRetryTick'
}
