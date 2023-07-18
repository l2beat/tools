import { continueOperations } from '../helpers/continueOperations'
import { RetryUpdateAction } from '../types/IndexerAction'
import { IndexerReducerResult } from '../types/IndexerReducerResult'
import { IndexerState } from '../types/IndexerState'

export function handleRetryUpdate(
  state: IndexerState,
  _action: RetryUpdateAction,
): IndexerReducerResult {
  return continueOperations({ ...state, retryingUpdate: false })
}
