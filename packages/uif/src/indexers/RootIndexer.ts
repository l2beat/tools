import { Logger } from '@l2beat/backend-tools'

import { BaseIndexer } from '../BaseIndexer'
import { RetryStrategy } from '../Retries'

export abstract class RootIndexer extends BaseIndexer {
  constructor(logger: Logger, opts?: { tickRetryStrategy?: RetryStrategy }) {
    super(logger, [], opts)
  }

  override async update(): Promise<number> {
    return Promise.reject(new Error('RootIndexer cannot update'))
  }

  override async invalidate(): Promise<number> {
    return Promise.reject(new Error('RootIndexer cannot invalidate'))
  }

  override async setSafeHeight(): Promise<void> {
    return Promise.resolve()
  }
}
