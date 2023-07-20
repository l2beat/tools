import { assertStatus } from '../helpers/assertStatus'
import { continueOperations } from '../helpers/continueOperations'
import { UpdateSucceededAction } from '../types/IndexerAction'
import { IndexerReducerResult } from '../types/IndexerReducerResult'
import { IndexerState } from '../types/IndexerState'

export function handleUpdateSucceeded(
  state: IndexerState,
  action: UpdateSucceededAction,
): IndexerReducerResult {
  assertStatus(state.status, 'updating')
  if (action.targetHeight >= state.height) {
    state = {
      ...state,
      status: 'idle',
      height: action.targetHeight,
      invalidateToHeight:
        state.invalidateToHeight === state.height && !state.forceInvalidate
          ? action.targetHeight
          : state.invalidateToHeight,
    }
  } else {
    state = {
      ...state,
      status: 'idle',
      invalidateToHeight: Math.min(
        action.targetHeight,
        state.invalidateToHeight,
      ),
      forceInvalidate: true,
    }
  }
  return continueOperations(state, { updateFinished: true })
}
