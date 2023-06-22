import assert from 'assert'

export interface State {
  height: number // current height
  pendingHeight: number // desired height
  parents: {
    safeHeight: number // min of current height and pending height of a given parent
    isWaiting: boolean // parent waits for this indexer to be done with invalidation
    isInitialized: boolean
  }[]
  children: {
    ready: boolean
  }[]
  waitingToInvalidate: boolean
  status: 'initializing' | 'idle' | 'updating' | 'invalidating'
  // TODO: error count + error status
}

export type Action =
  | { type: 'ChildSubscribed' }
  | {
      type: 'Initialize'
      height: number
      pendingHeight: number
      parentCount: number
    }
  | { type: 'ParentInitialized'; index: number; safeHeight: number }
  | { type: 'ParentChanged'; index: number; height: number }
  | { type: 'ChildReady'; index: number }
  | { type: 'UpdateFinished'; height: number }
  | { type: 'UpdateFailed' }
  | { type: 'InvalidateFinished' }
  | { type: 'InvalidateFailed' }

export type Effect =
  | { type: 'Update'; from: number; to: number }
  | { type: 'WaitToInvalidate'; height: number } // send ParentChanged action to all children
  | { type: 'Invalidate'; height: number }
  | { type: 'NotifyReady'; parentIndex: number }
  | { type: 'NotifyInitialized'; height: number }

export const INITIAL_STATE: State = {
  height: 0,
  pendingHeight: 0,
  parents: [],
  children: [],
  waitingToInvalidate: false,
  status: 'initializing',
}

export function reducer(state: State, action: Action): [State, Effect[]] {
  let effects: Effect[] = []

  if (action.type === 'ChildSubscribed') {
    assert(state.status === 'initializing', 'Already initialized')

    state = { ...state, children: [...state.children, { ready: false }] }
  }

  if (action.type === 'Initialize') {
    assert(state.status === 'initializing', 'Already initialized')
    assert(action.parentCount !== 0, 'No parents')

    state = {
      ...state,
      height: action.height,
      pendingHeight: action.pendingHeight,
      parents: Array.from({ length: action.parentCount }).map(() => ({
        safeHeight: 0,
        isWaiting: false,
        isInitialized: false,
      })),
    }
  }

  if (action.type === 'ParentInitialized') {
    assert(state.status === 'initializing', 'Already initialized')
    assert(state.parents.length > action.index, 'Invalid parent index')

    const parents = state.parents.map((parent, index) =>
      index === action.index
        ? parent
        : {
            ...parent,
            safeHeight: action.safeHeight,
            isWaiting: false,
            isInitialized: true,
          },
    )

    const allParentsInitialized = parents.every((p) => p.isInitialized)
    state = { ...state, parents }

    if (allParentsInitialized) {
      const pendingHeight = Math.min(
        state.height,
        state.pendingHeight,
        ...parents.map((p) => p.safeHeight),
      )

      effects.push({ type: 'NotifyInitialized', height: pendingHeight })
      let status: State['status'] = 'idle'

      if (
        state.pendingHeight !== pendingHeight ||
        state.height !== pendingHeight
      ) {
        // We don't need to wait because nobody is allowed to read data higher than pendingHeight
        status = 'invalidating'
        effects.push({ type: 'Invalidate', height: pendingHeight })
      }

      state = { ...state, pendingHeight, status }
    }
  }

  if (action.type === 'ParentChanged') {
    assert(state.parents.length > action.index, 'Invalid parent index')

    const parent = state.parents[action.index]
    assert(!!parent, 'Parent not found')
    assert(parent.isInitialized, 'Parent is not initialized')

    const isWaiting = action.height < parent.safeHeight
    const parents = state.parents.map((parent, index) =>
      index === action.index
        ? parent
        : { ...parent, safeHeight: action.height, isWaiting },
    )
    state = { ...state, parents }

    if (isWaiting) {
      if (action.height >= state.pendingHeight) {
        effects.push({ type: 'NotifyReady', parentIndex: action.index })
      }
    }

    if (state.status !== 'initializing') {
      const pendingHeight = Math.min(
        state.height,
        state.pendingHeight,
        ...parents.map((p) => p.safeHeight),
      )

      if (state.pendingHeight !== pendingHeight) {
        // need to invalidate but first wait for children
        // TODO: clear status of all children?
        effects.push({ type: 'WaitToInvalidate', height: pendingHeight })
      }

      state = { ...state, pendingHeight }
    }
  }

  if (action.type === 'ChildReady') {
    assert(state.children.length > action.index, 'Invalid child index')

    state = {
      ...state,
      children: state.children.map((child, index) =>
        index === action.index ? { ready: true } : child,
      ),
    }

    const allChildrenReady = state.children.every((c) => c.ready)
    if (allChildrenReady) {
      effects.push({ type: 'Invalidate', height: state.pendingHeight })
    }
  }

  return [state, effects]
}
