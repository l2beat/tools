import { Logger } from '@l2beat/backend-tools'
import { ChildIndexer, IndexerOptions } from '@l2beat/uif'

import { HourlyIndexer } from '../HourlyIndexer'
import { ONE_HOUR_MS } from '../utils'
import { BlockIndexerRepository } from './BlockIndexerRepository'
import { BlockRepository } from './BlockRepository'
import { BlockService } from './BlockService'

export class BlockIndexer extends ChildIndexer {
  constructor(
    private readonly blockService: BlockService,
    private readonly blockRepository: BlockRepository,
    private readonly blockIndexerRepository: BlockIndexerRepository,
    private readonly minHeight: number,
    hourlyIndexer: HourlyIndexer,
    logger: Logger,
    options?: IndexerOptions,
  ) {
    super(logger, [hourlyIndexer], options)
  }

  override async initialize(): Promise<number | null> {
    const height = await this.blockIndexerRepository.loadHeight()
    return height ?? null
  }

  override async setSafeHeight(height: number | null): Promise<void> {
    await this.blockIndexerRepository.saveHeight(height ?? undefined)
  }

  override async update(
    currentHeight: number | null,
    _targetHeight: number,
  ): Promise<number | null> {
    const nextHeight =
      currentHeight === null ? this.minHeight : currentHeight + 1
    const timestamp = nextHeight * ONE_HOUR_MS

    const block = await this.blockService.getBlockNumberBefore(timestamp)
    await this.blockRepository.save({ number: block, timestamp })

    return nextHeight
  }

  override async invalidate(
    targetHeight: number | null,
  ): Promise<number | null> {
    // We don't need to delete any data
    return Promise.resolve(targetHeight)
  }
}
