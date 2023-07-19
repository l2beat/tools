import { continueOperations } from '../helpers/continueOperations'
import { RetryInvalidateAction } from '../types/IndexerAction'
import { IndexerReducerResult } from '../types/IndexerReducerResult'
import { IndexerState } from '../types/IndexerState'

export function handleRetryInvalidate(
  state: IndexerState,
  _action: RetryInvalidateAction,
): IndexerReducerResult {
  const targetHeight = state.waiting
    ? Math.min(state.height, state.targetHeight)
    : state.safeHeight
  return continueOperations(
    { ...state, retryingInvalidate: false, targetHeight },
    { forceInvalidate: true },
  )
}
