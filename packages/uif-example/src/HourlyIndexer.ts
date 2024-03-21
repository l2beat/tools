import { RootIndexer } from '@l2beat/uif'

export class HourlyIndexer extends RootIndexer {
  async initialize(): Promise<number> {
    setInterval(() => this.requestTick(), 60 * 1000)
    return this.tick()
  }

  async tick(): Promise<number> {
    const hourInMs = 60 * 60 * 1000
    const time = (new Date().getTime() % hourInMs) * hourInMs
    return Promise.resolve(time)
  }
}
