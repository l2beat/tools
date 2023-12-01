import { Logger } from '@l2beat/backend-tools'
import { writeFileSync } from 'fs'

import { DiscoveryCliConfig } from '../config/config.discovery'
import { flattenLayout } from '../layout/flattenLayout'
import { mergeFlatLayouts } from '../layout/mergeFlatLayouts'
import { parseAndGetLayout } from '../layout/parseAndGetLayout'
import { EthereumAddress } from '../utils/EthereumAddress'
import { EtherscanLikeClient } from '../utils/EtherscanLikeClient'
import { HttpClient } from '../utils/HttpClient'

export async function layoutCommand(
  config: DiscoveryCliConfig,
  logger: Logger,
): Promise<void> {
  if (!config.layout) {
    return
  }
  const http = new HttpClient()
  const etherscanClient = EtherscanLikeClient.createForDiscovery(
    http,
    config.chain.etherscanUrl,
    config.chain.etherscanApiKey,
    config.chain.etherscanUnsupported,
  )
  await runLayout(etherscanClient, config.layout.addresses, logger)
}

async function runLayout(
  etherscanClient: EtherscanLikeClient,
  addresses: EthereumAddress[],
  logger: Logger,
): Promise<void> {
  const sources = await Promise.all(
    addresses.map((address) => etherscanClient.getContractSource(address)),
  )
  logger.info('Got sources', {
    lengths: sources.map((source) => source.SourceCode.length),
  })
  const layout = mergeFlatLayouts(
    sources.map((s) => flattenLayout(parseAndGetLayout(s))),
  )
  writeFileSync('layout.json', JSON.stringify(layout, null, 2))
  logger.info('Saved layout', { filename: 'layout.json', items: layout.length })
}
