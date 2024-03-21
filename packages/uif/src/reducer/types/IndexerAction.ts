export interface InitializedAction {
  type: 'Initialized'
  safeHeight: number | null
  childCount: number
}

export interface ParentUpdatedAction {
  type: 'ParentUpdated'
  index: number
  safeHeight: number | null
}

export interface ChildReadyAction {
  type: 'ChildReady'
  index: number
}

export interface UpdateSucceededAction {
  type: 'UpdateSucceeded'
  from: number | null
  newHeight: number | null
}

export interface UpdateFailedAction {
  type: 'UpdateFailed'
  fatal?: boolean
}

export interface RetryUpdateAction {
  type: 'RetryUpdate'
}

export interface InvalidateSucceededAction {
  type: 'InvalidateSucceeded'
  targetHeight: number | null
}

export interface InvalidateFailedAction {
  type: 'InvalidateFailed'
  fatal?: boolean
}

export interface RetryInvalidateAction {
  type: 'RetryInvalidate'
}

export interface RequestTickAction {
  type: 'RequestTick'
}

export interface TickSucceededAction {
  type: 'TickSucceeded'
  safeHeight: number
}

export interface TickFailedAction {
  type: 'TickFailed'
  fatal?: boolean
}

export interface RetryTickAction {
  type: 'RetryTick'
}

export type IndexerAction =
  | InitializedAction
  | ParentUpdatedAction
  | ChildReadyAction
  | UpdateSucceededAction
  | UpdateFailedAction
  | RetryUpdateAction
  | InvalidateSucceededAction
  | InvalidateFailedAction
  | RetryInvalidateAction
  | RequestTickAction
  | TickSucceededAction
  | TickFailedAction
  | RetryTickAction
