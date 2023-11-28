import { Logger } from '@l2beat/backend-tools'
import { writeFileSync } from 'fs'

import { DiscoveryCliConfig } from '../config/config.discovery'
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
  await runLayout(etherscanClient, config.layout.address, logger)
}

async function runLayout(
  etherscanClient: EtherscanLikeClient,
  address: EthereumAddress,
  logger: Logger,
): Promise<void> {
  const source = await etherscanClient.getContractSource(address)
  logger.info('Got sources', {
    length: source.SourceCode.length,
  })
  const layout = parseAndGetLayout(source)
  writeFileSync('layout.json', JSON.stringify(layout, null, 2))
  logger.info('Saved layout', { filename: 'layout.json', items: layout.length })
}
