import { Logger } from '@l2beat/backend-tools'

import { DiscoveryCliConfig } from '../config/config.discovery'
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
    addresses.map((a) => etherscanClient.getContractSource(a)),
  )
  logger.info('Got sources', {
    sources: sources.map((x) => x.SourceCode.length),
  })
}
