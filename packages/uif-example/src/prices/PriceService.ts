import { ONE_HOUR_MS } from '../utils'

export class PriceService {
  async getHourlyPrices(
    apiId: string,
    startHourInclusive: number,
    endHourInclusive: number,
  ): Promise<{ timestamp: number; price: number }[]> {
    apiId // use it so that eslint doesn't complain

    const prices: { timestamp: number; price: number }[] = []
    for (let t = startHourInclusive; t <= endHourInclusive; t += ONE_HOUR_MS) {
      prices.push({ timestamp: t, price: Math.random() * 1000 })
    }
    return Promise.resolve(prices)
  }
}
