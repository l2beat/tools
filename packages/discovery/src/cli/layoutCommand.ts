import { Logger } from '@l2beat/backend-tools'
import { existsSync, readFileSync, writeFileSync } from 'fs'

import { DiscoveryCliConfig } from '../config/config.discovery'
import { getCombinedLayout } from '../layout/getCombinedLayout'
import { EthereumAddress } from '../utils/EthereumAddress'
import {
  ContractSource,
  EtherscanLikeClient,
} from '../utils/EtherscanLikeClient'
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
  let sources: ContractSource[] = []
  if (existsSync('sources.json')) {
    sources = JSON.parse(
      readFileSync('sources.json', 'utf-8'),
    ) as ContractSource[]
  } else {
    sources = await Promise.all(
      addresses.map((a) => etherscanClient.getContractSource(a)),
    )
    writeFileSync('sources.json', JSON.stringify(sources))
  }
  logger.info('Got sources', {
    sources: sources.map((x) => x.SourceCode.length),
  })
  const layout = getCombinedLayout(sources)
  logger.info('Layout', { layout })
}
