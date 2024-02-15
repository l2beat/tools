import { writeFile } from 'fs/promises'
import { mkdirp } from 'mkdirp'
import path, { dirname, posix } from 'path'
import { rimraf } from 'rimraf'

import { flattenStartingFrom } from '../../flatten/flattenStartingFrom'
import { ParsedFilesManager } from '../../flatten/ParsedFilesManager'
import { EthereumAddress } from '../../utils/EthereumAddress'
import { Analysis } from '../analysis/AddressAnalyzer'
import { DiscoveryConfig } from '../config/DiscoveryConfig'
import { removeSharedNesting } from '../source/removeSharedNesting'
import { toDiscoveryOutput } from './toDiscoveryOutput'
import { toPrettyJson } from './toPrettyJson'
import { DiscoveryLogger } from '../DiscoveryLogger'

export async function saveDiscoveryResult(
  results: Analysis[],
  config: DiscoveryConfig,
  blockNumber: number,
  logger: DiscoveryLogger,
  options: {
    rootFolder?: string
    sourcesFolder?: string
    discoveryFilename?: string
  },
): Promise<void> {
  const root =
    options.rootFolder ?? path.join('discovery', config.name, config.chain)
  await mkdirp(root)

  await saveDiscoveredJson(root, results, config, blockNumber, options)
  await saveSources(root, results, options)
  await saveFlatSources(root, results, logger, options)
}

async function saveDiscoveredJson(
  rootPath: string,
  results: Analysis[],
  config: DiscoveryConfig,
  blockNumber: number,
  options: {
    rootFolder?: string
    sourcesFolder?: string
    discoveryFilename?: string
  },
): Promise<void> {
  const project = toDiscoveryOutput(
    config.name,
    config.chain,
    config.hash,
    blockNumber,
    results,
  )
  const json = await toPrettyJson(project)
  const discoveryFilename = options.discoveryFilename ?? 'discovered.json'
  await writeFile(path.join(rootPath, discoveryFilename), json)
}

async function saveSources(
  rootPath: string,
  results: Analysis[],
  options: {
    rootFolder?: string
    sourcesFolder?: string
    discoveryFilename?: string
  },
): Promise<void> {
  const sourcesFolder = options.sourcesFolder ?? '.code'
  const sourcesPath = path.join(rootPath, sourcesFolder)
  const allContractNames = results.map((c) =>
    c.type !== 'EOA' ? c.name : 'EOA',
  )

  await rimraf(sourcesPath)
  for (const contract of results) {
    if (contract.type === 'EOA') {
      continue
    }

    for (const [i, files] of contract.sources.entries()) {
      const simplified = removeSharedNesting(Object.entries(files))
      for (const [fileName, content] of simplified) {
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

async function saveFlatSources(
  rootPath: string,
  results: Analysis[],
  logger: DiscoveryLogger,
  options: {
    rootFolder?: string
    sourcesFolder?: string
    discoveryFilename?: string
  },
): Promise<void> {
  const sourcesFolder = options.sourcesFolder ?? '.code'
  const flatSourcesFolder = `${sourcesFolder}-flat`
  const flatSourcesPath = path.join(rootPath, flatSourcesFolder)
  await rimraf(flatSourcesPath)

  logger.log(`Saving flattened sources`)
  for (const contract of results) {
    try {
      if (contract.type === 'EOA') {
        continue
      }

      for (const [i, files] of contract.sources.entries()) {
        const isProxy = contract.sources.length > 1 && i === 0
        if (isProxy) {
          continue
        }

        const input = Object.entries(files)
          .map(([fileName, content]) => ({
            path: fileName,
            content,
          }))
          .filter((e) => e.path.endsWith('.sol'))

        const parsedFileManager = ParsedFilesManager.parseFiles(
          input,
          contract.remappings,
        )
        const output = flattenStartingFrom(
          contract.derivedName ?? contract.name,
          parsedFileManager,
        )

        const path = posix.join(flatSourcesPath, `${contract.name}.sol`)
        await mkdirp(dirname(path))
        await writeFile(path, output)

        logger.log(`[ OK ]: ${contract.name}`)
      }
    } catch (e) {
      console.log(
        `[FAIL]: ${
          contract.type !== 'EOA'
            ? contract.derivedName ?? contract.name
            : 'EOA'
        } - ${stringifyError(e)}`,
      )
    }
  }
}

function stringifyError(e: unknown): string {
  if (e instanceof Error) {
    return e.message
  } else if (typeof e === 'string') {
    return e
  }

  return JSON.stringify(e)
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

  const implementationFolder = getImplementationFolder(fileIndex, filesCount)

  return path.join(
    root,
    `${contractName}${uniquenessSuffix}`,
    implementationFolder,
    fileName,
  )
}

/**
 * Returns the name of the folder under which to save the source code.
 * If there is only one source, it returns '', meaning that the source code
 * will be saved at current folder level.
 *
 * If there are 2 sources, it returns '/proxy' or '/implementation'.
 * If there are more it returns
 * '/proxy', '/implementation-1', '/implementation-2', etc.
 */
export function getImplementationFolder(
  i: number,
  sourcesCount: number,
): string {
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
