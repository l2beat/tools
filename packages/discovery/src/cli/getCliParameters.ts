import { Command } from 'commander'

import { ChainId } from '../utils/ChainId'
import { EthereumAddress } from '../utils/EthereumAddress'

export type CliParameters =
  | ServerCliParameters
  | DiscoverCliParameters
  | InvertCliParameters
  | SingleDiscoveryCliParameters

export interface ServerCliParameters {
  mode: 'server'
}

export interface DiscoverCliParameters {
  mode: 'discover'
  project: string
  chain: ChainId
  dryRun: boolean
  dev: boolean
  sourcesFolder?: string
  discoveryFilename?: string
  blockNumber?: number
}

export interface InvertCliParameters {
  mode: 'invert'
  project: string
  chain: ChainId
  useMermaidMarkup: boolean
}
export interface SingleDiscoveryCliParameters {
  mode: 'single-discovery'
  address: EthereumAddress
  chain: ChainId
}

export function getCliParameters(
  args = process.argv,
): CliParameters | undefined {
  const program = new Command('discovery')
  program.showHelpAfterError()

  let result: CliParameters | undefined = undefined

  program
    .command('server')
    .allowExcessArguments(false)
    .description('Start the server')
    .action(() => {
      result = { mode: 'server' }
    })

  const chainArguement = program.createArgument('<chain>', 'Target L1 Chain')
  const projectArguement = program.createArgument('<project>', 'Project name')

  program
    .command('discover')
    .allowExcessArguments(false)
    .description('Discover a rollup project on a chain')
    .addArgument(chainArguement)
    .addArgument(projectArguement)
    .option('--dry-run', 'Do not write the results to disk', false)
    .option('--dev', 'Use the development config', false)
    .option('--block-number <BLOCKNUMBER>', 'Block number to use for discovery')
    .option('--sources-folder <SOURCE>', 'Folder to read sources from')
    .option('--discovery-filename <FILENAME>', 'Filename to write discovery to')
    .action((chain, project, options) => {
      const {
        dryRun,
        dev,
        blockNumber: blockNumberStr,
        sourcesFolder,
        discoveryFilename,
      } = options as {
        dryRun: boolean
        dev: boolean
        blockNumber?: string
        sourcesFolder?: string
        discoveryFilename?: string
      }

      const chainId = getChainIdSafe(chain as string)
      if (!chainId) {
        displayWrongChainNameError(program, chain as string)
      }

      let blockNumber: number | undefined
      if (blockNumberStr) {
        blockNumber = parseInt(blockNumberStr, 10)
        if (blockNumber.toString() !== blockNumberStr)
          program.error(`"${blockNumberStr}" is not a valid block number`)
      }

      result = {
        mode: 'discover',
        chain: chainId!,
        project: project as string,
        dryRun,
        dev,
        sourcesFolder,
        discoveryFilename,
        blockNumber,
      } as DiscoverCliParameters
    })

  program
    .command('invert')
    .allowExcessArguments(false)
    .description('Run inversion on discovered data of a project on a chain')
    .addArgument(chainArguement)
    .addArgument(projectArguement)
    .option('--mermaid', 'Generate mermaid diagram', false)
    .action((chain, project, optionss) => {
      const { mermaid } = optionss as { mermaid: boolean }
      const chainId = getChainIdSafe(chain as string)
      if (!chainId) {
        displayWrongChainNameError(program, chain as string)
      }

      result = {
        mode: 'invert',
        chain: chainId!,
        project: project as string,
        useMermaidMarkup: mermaid,
      } as InvertCliParameters
    })

  program
    .command('single-discovery')
    .allowExcessArguments(false)
    .description('Discover a single address on a chain')
    .addArgument(chainArguement)
    .argument('<address>', 'Address to discover')
    .action((chain, address) => {
      const chainId = getChainIdSafe(chain as string)
      if (!chainId) {
        displayWrongChainNameError(program, chain as string)
      }

      result = {
        mode: 'single-discovery',
        chain: chainId!,
        address: EthereumAddress(address as string),
      } as SingleDiscoveryCliParameters
    })

  program.parse(args)

  return result
}

function getChainIdSafe(name: string): ChainId | undefined {
  try {
    return ChainId.fromName(name)
  } catch (e) {
    return undefined
  }
}

function displayWrongChainNameError(program: Command, chainName: string): void {
  program.error(
    `Argument provided ${chainName} could not be linked to any of the known chain names`,
  )
}
