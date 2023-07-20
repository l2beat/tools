import assert from 'node:assert'

import { RetryTickAction } from '../types/IndexerAction'
import { IndexerReducerResult } from '../types/IndexerReducerResult'
import { IndexerState } from '../types/IndexerState'

export function handleRetryTick(
  state: IndexerState,
  _action: RetryTickAction,
): IndexerReducerResult {
  assert(state.tickBlocked, 'should be retrying tick')

  return [
    { ...state, status: 'ticking', tickScheduled: false },
    [{ type: 'Tick' }],
  ]
}
