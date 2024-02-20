import { getEnv } from '@l2beat/backend-tools'
import { config as dotenv } from 'dotenv'

import { CliParameters } from '../cli/getCliParameters'
import { chains } from './chains'
import { DiscoveryChainConfig, DiscoveryCliConfig } from './types'

export function getDiscoveryCliConfig(cli: CliParameters): DiscoveryCliConfig {
  dotenv()

  if (
    cli.mode !== 'invert' &&
    cli.mode !== 'discover' &&
    cli.mode !== 'single-discovery'
  ) {
    throw new Error(`No local config for mode: ${cli.mode}`)
  }

  const discoveryEnabled = cli.mode === 'discover'
  const singleDiscoveryEnabled = cli.mode === 'single-discovery'
  const invertEnabled = cli.mode === 'invert'

  return {
    invert: invertEnabled && {
      project: cli.project,
      chain: getChainConfig(cli.chain),
      useMermaidMarkup: cli.useMermaidMarkup,
    },
    discovery: discoveryEnabled && {
      project: cli.project,
      chain: getChainConfig(cli.chain),
      dryRun: cli.dryRun,
      dev: cli.dev,
      blockNumber: cli.blockNumber,
      sourcesFolder: cli.sourcesFolder,
      discoveryFilename: cli.discoveryFilename,
    },
    singleDiscovery: singleDiscoveryEnabled && {
      address: cli.address,
      chain: getChainConfig(cli.chain),
    },
  }
}

export function getChainConfig(chain: string): DiscoveryChainConfig {
  const env = getEnv()

  const chainConfig = chains.find((c) => c.name === chain)
  if (!chainConfig) {
    throw new Error(`No config for chain: ${chain}`)
  }

  const ENV_NAME = chainConfig.name.toUpperCase()
  return {
    name: chainConfig.name,
    rpcUrl: env.string(`DISCOVERY_${ENV_NAME}_RPC_URL`),
    rpcGetLogsMaxRange: env.optionalInteger(
      `DISCOVERY_${ENV_NAME}_RPC_GETLOGS_MAX_RANGE`,
    ),
    multicall: chainConfig.multicall,
    etherscanApiKey: env.string(`DISCOVERY_${ENV_NAME}_ETHERSCAN_API_KEY`),
    etherscanUrl: chainConfig.etherscanUrl,
    etherscanUnsupported: chainConfig.etherscanUnsupported,
  }
}
