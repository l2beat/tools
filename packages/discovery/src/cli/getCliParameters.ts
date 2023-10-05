import { assert } from '@l2beat/backend-tools'

import { ChainId } from '../utils/ChainId'
import { EthereumAddress } from '../utils/EthereumAddress'

export type CliParameters =
  | ServerCliParameters
  | DiscoverCliParameters
  | InvertCliParameters
  | HelpCliParameters
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

export interface HelpCliParameters {
  mode: 'help'
  error?: string
}

export function getCliParameters(args = process.argv.slice(2)): CliParameters {
  if (args.includes('--help') || args.includes('-h')) {
    return { mode: 'help' }
  }

  if (args.length === 0) {
    return { mode: 'help', error: 'Not enough arguments' }
  }

  if (args[0] === 'server') {
    if (args.length !== 1) {
      return { mode: 'help', error: 'Too many arguments' }
    }
    return { mode: 'server' }
  }

  if (args[0] === 'discover') {
    const remaining = args.slice(1)

    let dryRun = false
    let dev = false
    let blockNumber: number | undefined
    let sourcesFolder: string | undefined
    let discoveryFilename: string | undefined

    if (remaining.includes('--dry-run')) {
      dryRun = true
      remaining.splice(remaining.indexOf('--dry-run'), 1)
    }

    if (remaining.includes('--dev')) {
      dev = true
      remaining.splice(remaining.indexOf('--dev'), 1)
    }

    const blockNumberArg = extractArgWithValue(remaining, '--block-number')
    if (blockNumberArg.found) {
      const blockNumberStr = blockNumberArg.value
      if (blockNumberStr === undefined) {
        return { mode: 'help', error: 'Please provide a valid block number' }
      }
      blockNumber = parseInt(blockNumberStr, 10)
      assert(
        blockNumber.toString() === blockNumberStr,
        `"${blockNumberStr}" is not a valid block number`,
      )
    }

    const sourcesFolderArg = extractArgWithValue(remaining, '--sources-folder')
    if (sourcesFolderArg.found) {
      sourcesFolder = sourcesFolderArg.value
    }

    const discoveryFilenameArg = extractArgWithValue(
      remaining,
      '--discovery-filename',
    )
    if (discoveryFilenameArg.found) {
      discoveryFilename = discoveryFilenameArg.value
    }

    if (remaining.length === 0) {
      return { mode: 'help', error: 'Not enough arguments' }
    }
    if (remaining.length > 2) {
      return { mode: 'help', error: 'Too many arguments' }
    }

    assert(remaining[0] && remaining[1], 'Not enough arguments despite length')

    const result: DiscoverCliParameters = {
      mode: 'discover',
      chain: ChainId.fromName(remaining[0]),
      project: remaining[1],
      dryRun,
      dev,
      sourcesFolder,
      discoveryFilename,
      blockNumber,
    }
    return result
  }

  if (args[0] === 'invert') {
    const remaining = args.slice(1)

    let useMermaidMarkup = false

    if (remaining.includes('--mermaid')) {
      useMermaidMarkup = true
      remaining.splice(remaining.indexOf('--mermaid'), 1)
    }

    if (remaining.length === 0) {
      return { mode: 'help', error: 'Not enough arguments' }
    }
    if (remaining.length > 2) {
      return { mode: 'help', error: 'Too many arguments' }
    }

    assert(remaining[0] && remaining[1], 'Not enough arguments despite length')

    const result: InvertCliParameters = {
      mode: 'invert',
      chain: ChainId.fromName(remaining[0]),
      project: remaining[1],
      useMermaidMarkup,
    }
    return result
  }

  if (args[0] === 'single-discovery') {
    const remaining = args.slice(1)

    if (remaining.length === 0) {
      return { mode: 'help', error: 'Not enough arguments' }
    }
    if (remaining.length > 2) {
      return { mode: 'help', error: 'Too many arguments' }
    }
    assert(remaining[0] && remaining[1], 'Not enough arguments despite length')

    const result: SingleDiscoveryCliParameters = {
      mode: 'single-discovery',
      chain: ChainId.fromName(remaining[0]),
      address: EthereumAddress(remaining[1]),
    }
    return result
  }

  const mode = args[0] ?? '<unknown mode>'

  return { mode: 'help', error: `Unknown mode: ${mode}` }
}

function extractArgWithValue(
  args: string[],
  argName: string,
): { found: false } | { found: true; value: string | undefined } {
  assert(argName.startsWith('--'), 'Argument name must start with "--"')
  const argIndex = args.findIndex((arg) => arg.startsWith(`${argName}=`))
  if (argIndex !== -1) {
    const value = args[argIndex]?.split('=')[1]
    args.splice(argIndex, 1)
    return { found: true, value }
  }
  return { found: false }
}

// const blockNumberIndex = remaining.findIndex((arg) =>
// arg.startsWith('--block-number='),
// )
// if (blockNumberIndex !== -1) {
// const blockNumberStr = remaining[blockNumberIndex]?.split('=')[1]
// if (blockNumberStr === undefined) {
// return { mode: 'help', error: 'Please provide a valid block number' }
// }
// blockNumber = parseInt(blockNumberStr, 10)
// assert(
// blockNumber.toString() === blockNumberStr,
// `"${blockNumberStr}" is not a valid block number`,
// )
// remaining.splice(blockNumberIndex, 1)
// }
