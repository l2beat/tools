import { writeFile } from 'fs/promises'
import { mkdirp } from 'mkdirp'
import { dirname } from 'path'
import { rimraf } from 'rimraf'

import { ChainId } from '../../utils/ChainId'
import { EthereumAddress } from '../../utils/EthereumAddress'
import { Hash256 } from '../../utils/Hash256'
import { Analysis } from '../analysis/AddressAnalyzer'
import { DiscoveryConfig } from '../config/DiscoveryConfig'
import { toDiscoveryOutput } from './toDiscoveryOutput'
import { toPrettyJson } from './toPrettyJson'

export async function saveDiscoveryResult(
  results: Analysis[],
  config: DiscoveryConfig,
  blockNumber: number,
  configHash: Hash256,
  chain: ChainId,
  sourcesFolder?: string,
  discoveryFilename?: string,
): Promise<void> {
  const project = toDiscoveryOutput(
    config.name,
    config.chainId,
    configHash,
    blockNumber,
    results,
  )
  const json = await toPrettyJson(project)

  const chainName = ChainId.getName(chain).toString()

  const root = `discovery/${config.name}/${chainName}`

  discoveryFilename ??= 'discovered.json'
  await writeFile(`${root}/${discoveryFilename}`, json)

  sourcesFolder ??= '.code'
  const sourcesPath = `${root}/${sourcesFolder}`
  const allContractNames = results.map((c) =>
    c.type !== 'EOA' ? c.name : 'EOA',
  )
  await rimraf(sourcesPath)
  for (const contract of results) {
    if (contract.type === 'EOA') {
      continue
    }
    for (const [i, files] of contract.sources.entries()) {
      for (const [fileName, content] of Object.entries(files)) {
        const path = getSourceOutputPath(
          fileName,
          i,
          contract.sources.length,
          contract.name,
          contract.address,
          sourcesPath,
          allContractNames,
        )
        await mkdirp(dirname(path))
        await writeFile(path, content)
      }
    }
  }
}

export function getSourceOutputPath(
  fileName: string,
  fileIndex: number,
  filesCount: number,
  contractName: string,
  contractAddress: EthereumAddress,
  root: string,
  allContractNames: string[],
): string {
  // If there are multiple different contracts discovered with the same
  // name, append their address to the folder name.
  const hasNameClash =
    allContractNames.filter((n) => n === contractName).length > 1
  const uniquenessSuffix = hasNameClash ? `-${contractAddress.toString()}` : ''

  const implementationSuffix = getSourceName(fileIndex, filesCount)

  return `${root}/${contractName}${uniquenessSuffix}${implementationSuffix}/${fileName}`
}

/**
 * Returns the name of the folder under which to save the source code.
 * /.code/[getSourceName(...)]/[file]
 *
 * If there is only one source, it returns '', meaning that the source code
 * will be saved under /.code/[file].
 *
 * If there are 2 sources, it returns '/proxy' or '/implementation'.
 *
 * If there are more it returns '/proxy', '/implementation-1', '/implementation-2', etc.
 */
export function getSourceName(i: number, sourcesCount: number): string {
  let name = ''
  if (sourcesCount > 1) {
    name = i === 0 ? 'proxy' : 'implementation'
  }
  if (sourcesCount > 2 && i > 0) {
    name += `-${i}`
  }
  if (name) {
    name = `/${name}`
  }
  return name
}
