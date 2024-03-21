import { Logger } from '@l2beat/backend-tools'

import { HourlyIndexer } from './HourlyIndexer'

export class Application {
  start: () => Promise<void>

  constructor() {
    const logger = Logger.DEBUG

    const hourlyIndexer = new HourlyIndexer(logger)

    this.start = async (): Promise<void> => {
      logger.for('Application').info('Starting')

      hourlyIndexer.start()

      logger.for('Application').info('Started')
    }
  }
}
