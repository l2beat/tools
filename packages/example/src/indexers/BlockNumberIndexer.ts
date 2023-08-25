import { Logger } from '@l2beat/backend-tools'
import { ChildIndexer, Retries } from '@l2beat/uif'

import { setTimeout } from 'timers/promises'
import { BlockNumberRepository } from '../repositories/BlockNumberRepository'
import { FakeClockIndexer } from './FakeClockIndexer'

export class BlockNumberIndexer extends ChildIndexer {
  constructor(
    logger: Logger,
    fakeClockIndexer: FakeClockIndexer,
    private readonly blockNumberRepository: BlockNumberRepository,
  ) {
    super(logger, [fakeClockIndexer], {
      updateRetryStrategy: Retries.exponentialBackOff({
        initialTimeoutMs: 100,
        maxAttempts: 10,
      }),
    })
  }

  override async update(from: number, to: number): Promise<number> {
    await setTimeout(2_000)
    if (Math.random() < 0.5) {
      throw new Error('Random error while updating')
    }
    return to
  }

  override async invalidate(to: number): Promise<number> {
    if (Math.random() < 0.5) {
      throw new Error('Random error while invalidating')
    }
    await Promise.resolve()
    return to
  }

  override async getSafeHeight(): Promise<number> {
    const height = await this.blockNumberRepository.getLastSynced()
    return height ?? 0
  }

  override async setSafeHeight(height: number): Promise<void> {
    return this.blockNumberRepository.setLastSynced(height)
  }
}
