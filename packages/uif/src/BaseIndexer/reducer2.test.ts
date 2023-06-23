import { expect } from 'earl'
import { Action, Effect, INITIAL_STATE, State, reducer } from './reducer2'

describe(reducer.name, () => {
  it('works in a happy case', () => {
    // ┌─────────┐┌─────────┐
    // │Parent #1││Parent #2│
    // └┬────────┘└┬────────┘
    // ┌▽──────────▽─────────┐
    // │    --> TEST <--     │
    // └┬─────────┬─────────┬┘
    // ┌▽───────┐┌▽───────┐┌▽───────┐
    // │Child #1││Child #2││Child #3│
    // └────────┘└────────┘└────────┘

    const [stateAfterInit, effectsAfterInit] = reduce(INITIAL_STATE, [
      { type: 'ChildSubscribed' },
      { type: 'ChildSubscribed' },
      { type: 'ChildSubscribed' },
      { type: 'Initialize', height: 10, pendingHeight: 10, parentCount: 2 },
      { type: 'ParentInitialized', index: 0, safeHeight: 10 },
      { type: 'ParentInitialized', index: 1, safeHeight: 10 },
    ])

    expect(stateAfterInit).toEqual({
      status: 'idle',
      height: 10,
      pendingHeight: 10,
      parents: [
        { safeHeight: 10, isWaiting: false, isInitialized: true },
        { safeHeight: 10, isWaiting: false, isInitialized: true },
      ],
      children: [{ ready: false }, { ready: false }, { ready: false }],
      waitingToInvalidate: false,
    })
    expect(effectsAfterInit).toEqual([
      { type: 'NotifyInitialized', height: 10 },
    ])

    const [stateAfterParentChanges, effectsAfterParentChanges] = reduce(
      stateAfterInit,
      [
        { type: 'ParentChanged', index: 0, height: 5 },
        { type: 'ChildReady', index: 0 },
        { type: 'ChildReady', index: 1 },
        { type: 'ChildReady', index: 2 },
      ],
    )

    expect(stateAfterParentChanges).toEqual({
      status: 'invalidating',
      height: 10,
      pendingHeight: 5,
      parents: [
        { safeHeight: 5, isWaiting: true, isInitialized: true },
        { safeHeight: 10, isWaiting: false, isInitialized: true },
      ],
      children: [{ ready: false }, { ready: false }, { ready: false }],
      waitingToInvalidate: false,
    })
    expect(effectsAfterParentChanges).toEqual([
      { type: 'WaitToInvalidate', height: 5 },
      { type: 'Invalidate', height: 5 },
    ])
  })
})

function reduce(initialState: State, actions: Action[]): [State, Effect[]] {
  return actions.reduce<[State, Effect[]]>(
    (stateAndEffects, action) => {
      const [state, effects] = stateAndEffects

      const newStateAndEffects = reducer(state, action)

      return [
        newStateAndEffects[0], // last state
        [...effects, ...newStateAndEffects[1]], // concat effects
      ]
    },
    [initialState, []],
  )
}

// 0. invalidate everything above invalidate
// 1. Support getting to updating state
// 2. UpdateFinish controls batching
// 3. updateFinish during parent invalidation
// 4. invalidateFinish...
// 5. support updateFailed and invalidateFailed, trigger invalidation again
