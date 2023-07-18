import { expect } from 'earl'

import { getInitialState } from './getInitialState'
import { indexerReducer } from './indexerReducer'
import { IndexerAction } from './types/IndexerAction'
import { IndexerReducerResult } from './types/IndexerReducerResult'
import { IndexerState } from './types/IndexerState'

describe(indexerReducer.name, () => {
  describe('Initialization', () => {
    it('arrives to the idle state', () => {
      const initState = getInitialState(1)
      const [state, effects] = reduceWithIndexerReducer(initState, [
        { type: 'Initialized', safeHeight: 0, childCount: 0 },
        { type: 'ParentUpdated', index: 0, safeHeight: 0 },
        { type: 'InvalidateSucceeded', targetHeight: 0 },
      ])

      expect(state).toEqual({
        ...initState,
        initializedSelf: true,
        status: 'idle',
        parents: [{ safeHeight: 0, initialized: true, waiting: false }],
      })
      expect(effects).toEqual([])
    })

    describe('parent not initialized', () => {
      it('only initializes', () => {
        const initState = getInitialState(1)
        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'Initialized', safeHeight: 0, childCount: 0 },
        ])

        expect(state).toEqual({
          ...initState,
          initializedSelf: true,
        })
        expect(effects).toEqual([])
      })

      it('skips the height check', () => {
        const initState = getInitialState(1)
        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'Initialized', safeHeight: 1, childCount: 0 },
        ])

        expect(state).toEqual({
          ...initState,
          height: 1,
          initializedSelf: true,
        })
        expect(effects).toEqual([])
      })
    })

    describe('parent initialized', () => {
      it('invalidates to parent height', () => {
        const initState = getInitialState(1)
        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'ParentUpdated', index: 0, safeHeight: 100 },
          { type: 'Initialized', safeHeight: 200, childCount: 0 },
        ])

        expect(state).toEqual({
          ...initState,
          status: 'invalidating',
          targetHeight: 100,
          safeHeight: 100,
          height: 200,
          initializedSelf: true,
          parents: [{ safeHeight: 100, initialized: true, waiting: false }],
        })
        expect(effects).toEqual([
          { type: 'SetSafeHeight', safeHeight: 100 },
          { type: 'Invalidate', targetHeight: 100 },
        ])
      })

      it('invalidates to parent height if parent initializes later', () => {
        const initState = getInitialState(1)
        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'Initialized', safeHeight: 200, childCount: 0 },
          { type: 'ParentUpdated', index: 0, safeHeight: 100 },
        ])

        expect(state).toEqual({
          ...initState,
          status: 'invalidating',
          targetHeight: 100,
          safeHeight: 100,
          height: 200,
          initializedSelf: true,
          parents: [{ safeHeight: 100, initialized: true, waiting: false }],
        })
        expect(effects).toEqual([
          { type: 'SetSafeHeight', safeHeight: 100 },
          { type: 'Invalidate', targetHeight: 100 },
        ])
      })

      it('invalidates to own height if parent is higher', () => {
        const initState = getInitialState(1)
        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'Initialized', safeHeight: 200, childCount: 0 },
          { type: 'ParentUpdated', index: 0, safeHeight: 300 },
        ])

        expect(state).toEqual({
          ...initState,
          status: 'invalidating',
          targetHeight: 200,
          safeHeight: 200,
          height: 200,
          initializedSelf: true,
          parents: [{ safeHeight: 300, initialized: true, waiting: false }],
        })
        expect(effects).toEqual([
          { type: 'SetSafeHeight', safeHeight: 200 },
          { type: 'Invalidate', targetHeight: 200 },
        ])
      })

      it('waits for all the parents', () => {
        const initState = getInitialState(3)
        // initialize and 2 parents update
        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'Initialized', safeHeight: 100, childCount: 0 },
          { type: 'ParentUpdated', index: 0, safeHeight: 50 },
          { type: 'ParentUpdated', index: 1, safeHeight: 150 },
        ])

        // initializedSelf is true but one of the parents is not initialized
        expect(state).toEqual({
          ...initState,
          height: 100,
          initializedSelf: true,
          parents: [
            { safeHeight: 50, initialized: true, waiting: false },
            { safeHeight: 150, initialized: true, waiting: false },
            { safeHeight: 0, initialized: false, waiting: false },
          ],
        })
        expect(effects).toEqual([])

        const [state2, effects2] = reduceWithIndexerReducer(state, [
          { type: 'ParentUpdated', index: 2, safeHeight: 100 },
        ])

        // when last parents updates, we invalidate and finish startup
        expect(state2).toEqual({
          ...initState,
          status: 'invalidating',
          height: 100,
          targetHeight: 50,
          safeHeight: 50,
          initializedSelf: true,
          parents: [
            { safeHeight: 50, initialized: true, waiting: false },
            { safeHeight: 150, initialized: true, waiting: false },
            { safeHeight: 100, initialized: true, waiting: false },
          ],
        })
        expect(effects2).toEqual([
          { type: 'SetSafeHeight', safeHeight: 50 },
          { type: 'Invalidate', targetHeight: 50 },
        ])
      })

      it('after invalidation updates to minimal parent height', () => {
        const initState = getInitialState(2)
        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'Initialized', safeHeight: 50, childCount: 0 },
          { type: 'ParentUpdated', index: 0, safeHeight: 100 },
          { type: 'ParentUpdated', index: 1, safeHeight: 150 },
          { type: 'InvalidateSucceeded', targetHeight: 50 },
        ])

        expect(state).toEqual({
          ...initState,
          status: 'updating',
          safeHeight: 50,
          targetHeight: 100,
          height: 50,
          initializedSelf: true,
          parents: [
            { safeHeight: 100, initialized: true, waiting: false },
            { safeHeight: 150, initialized: true, waiting: false },
          ],
        })

        expect(effects).toEqual([{ type: 'Update', targetHeight: 100 }])
      })

      it('notifies ready when not started', () => {
        const initState = getInitialState(2)
        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'Initialized', safeHeight: 100, childCount: 0 },
          { type: 'ParentUpdated', index: 0, safeHeight: 100 },
          { type: 'ParentUpdated', index: 0, safeHeight: 50 },
          // The other parent is not initialized!
        ])

        expect(state).toEqual({
          ...initState,
          height: 100,
          initializedSelf: true,
          parents: [
            { safeHeight: 50, initialized: true, waiting: false },
            { safeHeight: 0, initialized: false, waiting: false },
          ],
        })

        expect(effects).toEqual([{ type: 'NotifyReady', parentIndices: [0] }])
      })
    })
  })

  describe('Normal operation', () => {
    describe('parent updated', () => {
      it('updates to parent height', () => {
        const initState = getAfterInit({
          safeHeight: 100,
          childCount: 0,
          parentHeights: [100, 150],
        })

        const [newState, effects] = reduceWithIndexerReducer(initState, [
          { type: 'ParentUpdated', index: 0, safeHeight: 200 },
        ])

        expect(newState).toEqual({
          ...initState,
          status: 'updating',
          targetHeight: 150,
          parents: [
            { safeHeight: 200, initialized: true, waiting: false },
            { safeHeight: 150, initialized: true, waiting: false },
          ],
        })

        expect(effects).toEqual([{ type: 'Update', targetHeight: 150 }])
      })

      it('invalidates to parent height', () => {
        const initState = getAfterInit({
          safeHeight: 100,
          childCount: 0,
          parentHeights: [100],
        })

        const [newState, effects] = reduceWithIndexerReducer(initState, [
          { type: 'ParentUpdated', index: 0, safeHeight: 50 },
        ])

        expect(newState).toEqual({
          ...initState,
          status: 'invalidating',
          targetHeight: 50,
          safeHeight: 50,
          parents: [{ safeHeight: 50, initialized: true, waiting: false }],
        })

        expect(effects).toEqual([
          { type: 'SetSafeHeight', safeHeight: 50 },
          { type: 'NotifyReady', parentIndices: [0] },
          { type: 'Invalidate', targetHeight: 50 },
        ])
      })

      it('wait for children before invalidating', () => {
        const initState = getAfterInit({
          safeHeight: 100,
          childCount: 1,
          parentHeights: [100],
        })

        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'ParentUpdated', index: 0, safeHeight: 50 },
        ])

        expect(state).toEqual({
          ...initState,
          status: 'idle',
          waiting: true,
          targetHeight: 50,
          safeHeight: 50,
          parents: [{ safeHeight: 50, initialized: true, waiting: true }],
          children: [{ ready: false }],
        })

        expect(effects).toEqual([{ type: 'SetSafeHeight', safeHeight: 50 }])

        const [state2, effects2] = reduceWithIndexerReducer(state, [
          { type: 'ChildReady', index: 0 },
        ])

        expect(state2).toEqual({
          ...initState,
          status: 'invalidating',
          targetHeight: 50,
          safeHeight: 50,
          parents: [{ safeHeight: 50, initialized: true, waiting: false }],
        })

        expect(effects2).toEqual([
          { type: 'NotifyReady', parentIndices: [0] },
          { type: 'Invalidate', targetHeight: 50 },
        ])
      })
    })

    describe('parent waiting', () => {
      it('dispatches notify ready when finished updating', () => {
        const initState = getAfterInit({
          safeHeight: 100,
          childCount: 0,
          parentHeights: [100],
        })

        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'ParentUpdated', index: 0, safeHeight: 200 },
        ])

        expect(state).toEqual({
          ...initState,
          status: 'updating',
          targetHeight: 200,
          parents: [{ safeHeight: 200, initialized: true, waiting: false }],
        })

        expect(effects).toEqual([{ type: 'Update', targetHeight: 200 }])

        const [state2, effects2] = reduceWithIndexerReducer(state, [
          { type: 'ParentUpdated', index: 0, safeHeight: 50 },
          { type: 'UpdateSucceeded', from: 100, targetHeight: 200 },
        ])

        expect(state2).toEqual({
          ...initState,
          status: 'invalidating',
          height: 200,
          safeHeight: 50,
          targetHeight: 50,
          parents: [{ safeHeight: 50, initialized: true, waiting: false }],
        })

        expect(effects2).toEqual([
          { type: 'NotifyReady', parentIndices: [0] },
          { type: 'Invalidate', targetHeight: 50 },
        ])
      })
    })

    describe('complex scenarios', () => {
      it('if parent is waiting, it keeps waiting until notifyReady', () => {
        //1. grandparent ticks lower (to: x1) && parent updating (to: x2)-> parent sets (safeHeight: x1), but still updating (to:x2), child sets (safeHeight: x1) -> parennt finishes update (to: x2, waiting: true), child notifies ready
        const initState = getAfterInit({
          safeHeight: 100,
          childCount: 1,
          parentHeights: [100],
        })

        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'ParentUpdated', index: 0, safeHeight: 50 },
          { type: 'ParentUpdated', index: 0, safeHeight: 50 },
        ])

        expect(state).toEqual({
          ...initState,
          status: 'idle',
          targetHeight: 50,
          safeHeight: 50,
          waiting: true,
          parents: [{ safeHeight: 50, initialized: true, waiting: true }],
          children: [{ ready: false }],
        })

        expect(effects).toEqual([])
      })

      it('does not emit extra SetSafeHeight effect in ChildIndexer', () => {
        const initState = getAfterInit({
          safeHeight: 100,
          childCount: 0,
          parentHeights: [100],
        })

        const [state1, effects1] = reduceWithIndexerReducer(initState, [
          { type: 'ParentUpdated', index: 0, safeHeight: 200 },
          { type: 'UpdateSucceeded', from: 100, targetHeight: 150 },
        ])

        expect(effects1).toEqual([
          { type: 'SetSafeHeight', safeHeight: 150 },
          { type: 'Update', targetHeight: 200 },
        ])

        const [state2, effects2] = reduceWithIndexerReducer(state1, [
          { type: 'ParentUpdated', index: 0, safeHeight: 140 },
        ])

        expect(effects2).toEqual([{ type: 'SetSafeHeight', safeHeight: 140 }])

        const [, effects3] = reduceWithIndexerReducer(state2, [
          { type: 'UpdateSucceeded', from: 150, targetHeight: 200 },
        ])

        expect(effects3).toEqual([
          { type: 'NotifyReady', parentIndices: [0] },
          { type: 'Invalidate', targetHeight: 140 },
        ])
      })
    })

    describe('root indexer', () => {
      it('does not invalidate on startup', () => {
        const initState = getInitialState(0)
        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'Initialized', safeHeight: 100, childCount: 0 },
        ])

        expect(state).toEqual({
          ...initState,
          initializedSelf: true,
          status: 'idle',
          height: 100,
          safeHeight: 100,
          targetHeight: 100,
        })
        expect(effects).toEqual([{ type: 'SetSafeHeight', safeHeight: 100 }])
      })

      it('runs the first tick', () => {
        const initState = getInitialState(0)
        const [state1, effects1] = reduceWithIndexerReducer(initState, [
          { type: 'Initialized', safeHeight: 100, childCount: 0 },
          { type: 'RequestTick' },
        ])

        expect(state1).toEqual({
          ...initState,
          status: 'ticking',
          height: 100,
          safeHeight: 100,
          targetHeight: 100,
          initializedSelf: true,
        })
        expect(effects1).toEqual([{ type: 'Tick' }])

        const [state2, effects2] = reduceWithIndexerReducer(state1, [
          { type: 'TickSucceeded', safeHeight: 150 },
        ])

        expect(state2).toEqual({
          ...initState,
          status: 'idle',
          height: 150,
          safeHeight: 150,
          targetHeight: 150,
          initializedSelf: true,
        })
        expect(effects2).toEqual([{ type: 'SetSafeHeight', safeHeight: 150 }])
      })

      it('remembers ticks', () => {
        const initState = getInitialState(0)
        const [state1, effects1] = reduceWithIndexerReducer(initState, [
          { type: 'Initialized', safeHeight: 100, childCount: 0 },
          { type: 'RequestTick' },
          { type: 'RequestTick' },
        ])

        expect(state1).toEqual({
          ...initState,
          status: 'ticking',
          tickScheduled: true,
          height: 100,
          safeHeight: 100,
          targetHeight: 100,
          initializedSelf: true,
        })
        expect(effects1).toEqual([])

        const [state2, effects2] = reduceWithIndexerReducer(state1, [
          { type: 'RequestTick' },
        ])

        expect(state2).toEqual(state1)
        expect(effects2).toEqual([])

        const [state3, effects3] = reduceWithIndexerReducer(state2, [
          { type: 'TickSucceeded', safeHeight: 150 },
        ])

        expect(state3).toEqual({
          ...initState,
          status: 'ticking',
          tickScheduled: false,
          height: 150,
          safeHeight: 150,
          targetHeight: 150,
          initializedSelf: true,
        })
        expect(effects3).toEqual([
          { type: 'SetSafeHeight', safeHeight: 150 },
          { type: 'Tick' },
        ])
      })
    })

    describe('errored state', () => {
      it('cannot tick', () => {
        const initState = getInitialState(0)
        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'Initialized', safeHeight: 100, childCount: 0 },
          { type: 'RequestTick' },
          { type: 'TickFailed', fatal: true },
          { type: 'RequestTick' },
        ])

        expect(state).toEqual({
          ...initState,
          status: 'errored',
          tickScheduled: false,
          height: 100,
          safeHeight: 100,
          targetHeight: 100,
          initializedSelf: true,
        })
        expect(effects).toEqual([])
      })

      it('does not remember requested ticks', () => {
        const initState = getInitialState(0)
        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'Initialized', safeHeight: 100, childCount: 0 },
          { type: 'RequestTick' },
          // Additional tick
          { type: 'RequestTick' },
          { type: 'TickFailed', fatal: true },
          { type: 'RequestTick' },
        ])

        expect(state).toEqual({
          ...initState,
          status: 'errored',
          tickScheduled: false,
          height: 100,
          safeHeight: 100,
          targetHeight: 100,
          initializedSelf: true,
        })
        expect(effects).toEqual([])
      })

      it('cannot update', () => {
        const initState = getAfterInit({
          safeHeight: 100,
          childCount: 0,
          parentHeights: [100],
        })

        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'ParentUpdated', index: 0, safeHeight: 200 },
          { type: 'UpdateFailed', fatal: true },
          { type: 'ParentUpdated', index: 0, safeHeight: 300 },
        ])

        expect(state).toEqual({
          ...initState,
          status: 'errored',
          targetHeight: 200, // doesn't matter
          height: 100,
          safeHeight: 100,
          parents: [{ safeHeight: 300, initialized: true, waiting: false }],
        })

        expect(effects).toEqual([])
      })

      it('cannot invalidate', () => {
        const initState = getAfterInit({
          safeHeight: 100,
          childCount: 0,
          parentHeights: [100],
        })

        const [state, effects] = reduceWithIndexerReducer(initState, [
          { type: 'ParentUpdated', index: 0, safeHeight: 50 },
          { type: 'InvalidateFailed', fatal: true },
          { type: 'ParentUpdated', index: 0, safeHeight: 20 },
        ])

        expect(state).toEqual({
          ...initState,
          status: 'errored',
          targetHeight: 20, // doesn't matter
          height: 100,
          safeHeight: 20,
          parents: [{ safeHeight: 20, initialized: true, waiting: false }],
        })

        expect(effects).toEqual([
          { type: 'SetSafeHeight', safeHeight: 20 },
          { type: 'NotifyReady', parentIndices: [0] },
        ])
      })

      it('waits for children to notify ready', () => {
        const initState = getAfterInit({
          safeHeight: 100,
          childCount: 2,
          parentHeights: [100],
        })

        const [state1, effects1] = reduceWithIndexerReducer(initState, [
          { type: 'ParentUpdated', index: 0, safeHeight: 200 },
          { type: 'UpdateFailed', fatal: true },
          { type: 'ParentUpdated', index: 0, safeHeight: 50 },
        ])

        expect(state1).toEqual({
          ...initState,
          status: 'errored',
          targetHeight: 50, // doesn't matter
          height: 100,
          safeHeight: 50,
          waiting: true,
          parents: [{ safeHeight: 50, initialized: true, waiting: true }],
          children: [{ ready: false }, { ready: false }],
        })
        expect(effects1).toEqual([{ type: 'SetSafeHeight', safeHeight: 50 }])

        const [state2, effects2] = reduceWithIndexerReducer(state1, [
          { type: 'ChildReady', index: 0 },
          { type: 'ChildReady', index: 1 },
        ])

        expect(state2).toEqual({
          ...initState,
          status: 'errored',
          targetHeight: 50, // doesn't matter
          height: 100,
          safeHeight: 50,
          waiting: false,
          parents: [{ safeHeight: 50, initialized: true, waiting: false }],
          children: [{ ready: true }, { ready: true }],
        })
        expect(effects2).toEqual([{ type: 'NotifyReady', parentIndices: [0] }])
      })
    })
  })
})

function getAfterInit({
  safeHeight,
  childCount,
  parentHeights,
}: {
  safeHeight: number
  childCount: number
  parentHeights: number[]
}): IndexerState {
  const initState = getInitialState(parentHeights.length)
  const [state] = reduceWithIndexerReducer(initState, [
    { type: 'Initialized', safeHeight, childCount },
    ...parentHeights.map((safeHeight, index) => ({
      type: 'ParentUpdated' as const,
      index,
      safeHeight,
    })),
    {
      type: 'InvalidateSucceeded',
      targetHeight: Math.min(safeHeight, ...parentHeights),
    },
  ])

  return state
}

function reduceWithIndexerReducer(
  initialState: IndexerState,
  actions: IndexerAction[],
): IndexerReducerResult {
  return actions.reduce<IndexerReducerResult>(
    ([state], action) => indexerReducer(state, action),
    [initialState, []],
  )
}
