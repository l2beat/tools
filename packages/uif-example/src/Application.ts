import { Logger } from '@l2beat/backend-tools'

import { HourlyIndexer } from './HourlyIndexer'
import { PriceIndexer } from './prices/PriceIndexer'
import { PriceIndexerRepository } from './prices/PriceIndexerRepository'
import { PriceRepository } from './prices/PriceRepository'
import { PriceService } from './prices/PriceService'
import { msToHours } from './utils'

export class Application {
  start: () => Promise<void>

  constructor() {
    const logger = Logger.DEBUG

    const hourlyIndexer = new HourlyIndexer(logger)

    const priceService = new PriceService()
    const priceRepository = new PriceRepository()
    const priceIndexerRepository = new PriceIndexerRepository()

    const ethereumPriceIndexer = new PriceIndexer(
      'price-ethereum',
      priceService,
      priceRepository,
      priceIndexerRepository,
      logger,
      [hourlyIndexer],
      [
        {
          // could be a hash of properties & minHeight instead
          id: 'eth-ethereum',
          properties: { tokenSymbol: 'ETH', apiId: 'ethereum' },
          minHeight: msToHours(new Date('2021-01-01T00:00:00Z').getTime()),
          maxHeight: null,
        },
        {
          id: 'weth-ethereum',
          properties: { tokenSymbol: 'WETH', apiId: 'ethereum' },
          minHeight: msToHours(new Date('2022-01-01T00:00:00Z').getTime()),
          maxHeight: null,
        },
      ],
    )
    const bitcoinPriceIndexer = new PriceIndexer(
      'price-bitcoin',
      priceService,
      priceRepository,
      priceIndexerRepository,
      logger,
      [hourlyIndexer],
      [
        {
          id: 'btc-bitcoin',
          properties: { tokenSymbol: 'BTC', apiId: 'bitcoin' },
          minHeight: msToHours(new Date('2022-01-01T00:00:00Z').getTime()),
          maxHeight: null,
        },
      ],
    )

    this.start = async (): Promise<void> => {
      logger.for('Application').info('Starting')

      await hourlyIndexer.start()
      await ethereumPriceIndexer.start()
      await bitcoinPriceIndexer.start()

      logger.for('Application').info('Started')
    }
  }
}
