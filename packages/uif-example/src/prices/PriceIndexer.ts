import { Logger } from '@l2beat/backend-tools'
import {
  Configuration,
  Indexer,
  IndexerOptions,
  MultiIndexer,
  RemovalConfiguration,
  SavedConfiguration,
  UpdateConfiguration,
} from '@l2beat/uif'

import { PriceConfig } from './PriceConfig'
import { PriceIndexerRepository } from './PriceIndexerRepository'
import { PriceRepository } from './PriceRepository'
import { PriceService } from './PriceService'

const ONE_HOUR = 60 * 60 * 1000

export class PriceIndexer extends MultiIndexer<PriceConfig> {
  private readonly apiId: string

  constructor(
    private readonly indexerId: string,
    private readonly priceService: PriceService,
    private readonly priceRepository: PriceRepository,
    private readonly priceIndexerRepository: PriceIndexerRepository,
    logger: Logger,
    parents: Indexer[],
    configurations: Configuration<PriceConfig>[],
    options?: IndexerOptions,
  ) {
    super(logger, parents, configurations, options)
    const apiId = configurations[0]?.properties.apiId
    if (!apiId) {
      throw new Error('At least one configuration is required')
    }
    if (configurations.some((c) => c.properties.apiId !== apiId)) {
      throw new Error('All configurations must have the same apiId')
    }
    this.apiId = apiId
  }

  override async multiInitialize(): Promise<SavedConfiguration<PriceConfig>[]> {
    return this.priceIndexerRepository.load(this.indexerId)
  }

  override async multiUpdate(
    currentHeight: number,
    targetHeight: number,
    configurations: UpdateConfiguration<PriceConfig>[],
  ): Promise<number> {
    const startHour = currentHeight - (currentHeight % ONE_HOUR) + ONE_HOUR
    const endHour = Math.min(
      targetHeight - (targetHeight % ONE_HOUR),
      // for example the api costs us more money for larger ranges
      startHour + 23 * ONE_HOUR,
    )

    if (startHour >= endHour) {
      return startHour
    }

    const prices = await this.priceService.getHourlyPrices(
      this.apiId,
      startHour,
      endHour,
    )

    const dataToSave = configurations.flatMap((configuration) => {
      return prices.map(({ timestamp, price }) => ({
        tokenSymbol: configuration.properties.tokenSymbol,
        timestamp,
        price,
      }))
    })
    await this.priceRepository.save(dataToSave)

    // TODO: Maybe if targetHeight is not exactly an hour we can return it?
    return endHour
  }

  override async removeData(
    configurations: RemovalConfiguration<PriceConfig>[],
  ): Promise<void> {
    for (const c of configurations) {
      await this.priceRepository.deletePrices(
        c.properties.tokenSymbol,
        c.fromHeightInclusive,
        c.toHeightInclusive,
      )
    }
  }

  override async saveConfigurations(
    configurations: SavedConfiguration<PriceConfig>[],
  ): Promise<void> {
    return this.priceIndexerRepository.save(this.indexerId, configurations)
  }
}
