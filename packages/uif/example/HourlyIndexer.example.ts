import { RootIndexer } from '../src/BaseIndexer'

export class HourlyIndexer extends RootIndexer {
  // initialize is only called once when the indexer is started
  async initialize() {
    // check every second
    setInterval(() => this.requestTick(), 1000)
    return this.tick()
  }

  // tick is called every time we request a new tick
  // It should return the new target height
  tick(): Promise<number> {
    const ONE_HOUR = 60 * 60 * 1000
    const now = Date.now()
    const lastHour = now - (now % ONE_HOUR)
    return Promise.resolve(lastHour)
  }
}
