export interface InitializedAction {
  type: 'Initialized'
  safeHeight: number
  childCount: number
}

export interface ParentUpdatedAction {
  type: 'ParentUpdated'
  index: number
  safeHeight: number
}

export interface ChildReadyAction {
  type: 'ChildReady'
  index: number
}

export interface UpdateSucceededAction {
  type: 'UpdateSucceeded'
  from: number
  targetHeight: number
}

export interface UpdateFailedAction {
  type: 'UpdateFailed'
  fatal?: boolean
}

export interface InvalidateSucceededAction {
  type: 'InvalidateSucceeded'
  targetHeight: number
}

export interface InvalidateFailedAction {
  type: 'InvalidateFailed'
  targetHeight: number
  fatal?: boolean
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

export type IndexerAction =
  | InitializedAction
  | ParentUpdatedAction
  | ChildReadyAction
  | UpdateSucceededAction
  | UpdateFailedAction
  | InvalidateSucceededAction
  | InvalidateFailedAction
  | RequestTickAction
  | TickSucceededAction
  | TickFailedAction
