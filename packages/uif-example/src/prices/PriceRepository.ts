export class PriceRepository {
  async save(
    prices: { tokenSymbol: string; timestamp: number; price: number }[],
  ): Promise<void> {
    prices // use it so that eslint doesn't complain
    return Promise.resolve()
  }

  async deletePrices(
    tokenSymbol: string,
    fromTimestampInclusive: number,
    toTimestampInclusive: number,
  ): Promise<void> {
    tokenSymbol // use it so that eslint doesn't complain
    fromTimestampInclusive // use it so that eslint doesn't complain
    toTimestampInclusive // use it so that eslint doesn't complain
    return Promise.resolve()
  }
}
