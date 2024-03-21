import { Logger } from '@l2beat/backend-tools'

import { BaseIndexer } from '../BaseIndexer'
import { RetryStrategy } from '../Retries'
/**
 * Because of the way TypeScript works, all child indexers need to
 * `extends RootIndexer` and `implements IRootIndexer`. Otherwise it
 * is possible to have incorrect method signatures and TypeScript won't
 * catch it.
 */
export interface IRootIndexer {
  /**
   * Initializes the indexer and returns the initial target height for the
   * entire system. If `setSafeHeight` is implemented it should return the
   * height that was saved previously. If not it can `return this.tick()`.
   *
   * This method should also schedule a process to request
   * ticks. For example with `setInterval(() => this.requestTick(), 1000)`.
   */
  initialize: () => Promise<number | null>

  /**
   * This method is responsible for providing the target height for the entire
   * system. Some candidates for this are: the current time or the latest block
   * number.
   *
   * This method cannot return `null`.
   */
  tick: () => Promise<number>

  /**
   * An optional method for saving the height (most likely to a database). The
   * height can be `null`.
   *
   * When `initialize` is called it is expected that it will read the same
   * height that was saved here.
   */
  setSafeHeight?: (height: number | null) => Promise<void>
}

export abstract class RootIndexer extends BaseIndexer implements IRootIndexer {
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
