import { writeFile } from 'fs/promises'
import { mkdirp } from 'mkdirp'
import { dirname } from 'path'
import { rimraf } from 'rimraf'

import { ChainId } from '../../utils/ChainId'
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
  await rimraf(sourcesPath)
  for (const result of results) {
    if (result.type === 'EOA') {
      continue
    }
    for (const [i, files] of result.sources.entries()) {
      for (const [file, content] of Object.entries(files)) {
        const codebase = getSourceName(i, result.sources.length)
        const path = `${sourcesPath}/${result.name}${codebase}/${file}`
        await mkdirp(dirname(path))
        await writeFile(path, content)
      }
    }
  }
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
export function getSourceName(i: number, length: number): string {
  let name = ''
  if (length > 1) {
    name = i === 0 ? 'proxy' : 'implementation'
  }
  if (length > 2 && i > 0) {
    name += `-${i}`
  }
  if (name) {
    name = `/${name}`
  }
  return name
}
