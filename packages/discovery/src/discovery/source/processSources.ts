import { assert } from '@l2beat/backend-tools'
import path from 'path'

import { EthereumAddress } from '../../utils/EthereumAddress'
import { ContractMetadata } from '../provider/DiscoveryProvider'
import { removeSharedNesting } from './removeSharedNesting'
import { decodeEtherscanSource } from './sourceToEntries'

export function processSources(
  address: EthereumAddress,
  { name, source, isVerified }: Omit<ContractMetadata, 'abi'>,
): Record<string, string> {
  let result: Record<string, string> = {}

  if (isVerified) {
    try {
      result = parseSource(name, source)
    } catch (e) {
      console.error(e)
      console.log(source)
    }
  }

  result['meta.txt'] = createMetaTxt(address, name, isVerified)
  return result
}

export function getRemappings({
  name,
  source,
  isVerified,
}: Omit<ContractMetadata, 'abi'>): string[] {
  if (!isVerified) {
    return []
  }

  return decodeEtherscanSource(name, source).remappings
}

function parseSource(name: string, source: string): Record<string, string> {
  const decodedSource = decodeEtherscanSource(name, source)
  const entries = decodedSource.sources

  if (entries.length === 1) {
    assert(entries[0], 'cannot parse source to single file')
    return parseSingleFile(...entries[0])
  }

  return Object.fromEntries(entries)
}

function parseSingleFile(
  file: string,
  content: string,
): Record<string, string> {
  const singleFile = { [path.basename(file)]: content }
  if (!content.includes('// File: ')) {
    return singleFile
  }

  const lines = content.split('\n')
  const boundaries = lines
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => line.startsWith('// File: '))

  if (boundaries.length === 0) {
    return singleFile
  }

  let preamble = lines.slice(0, boundaries[0]?.i).join('\n')
  if (preamble !== '') {
    preamble += '\n'
  }

  // Try to split the files based on likely output from truffle-flattener
  const entries: [string, string][] = []
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]?.i
    const end = boundaries[i + 1]?.i ?? lines.length
    const file = boundaries[i]?.line.slice('// File: '.length).trim()

    assert(start !== undefined, 'cannot obtain boundaries')
    assert(file !== undefined, 'cannot obtain file contents')

    const content = preamble + lines.slice(start + 1, end).join('\n')
    entries.push([file, content])
  }

  const simplified = removeSharedNesting(entries)
  simplified.push(['flattened.sol', content])
  return Object.fromEntries(simplified)
}

export function createMetaTxt(
  address: EthereumAddress,
  name: string,
  isVerified: boolean,
): string {
  if (!isVerified) {
    return `Address: ${address.toString()}\nSource code not verified!`
  }
  return `Address: ${address.toString()}\nContract: ${name}\n`
}
