import { Logger } from '@l2beat/backend-tools'
import { readdir, readFile, writeFile } from 'fs/promises'
import { basename, resolve } from 'path'

import { flattenStartingFrom } from './flattenStartingFrom'
import { ParsedFileManager } from './ParsedFilesManager'

export async function runFlatten(
  path: string,
  rootContractName: string,
  logger: Logger,
): Promise<void> {
  logger.info(`Path: ${path}`)
  logger.info(`Root contract name: ${rootContractName}`)

  const files = await Promise.all(
    filterOutNonSolidityFiles(await listFilesRecursively(path)).map((f) =>
      read(f),
    ),
  )

  const remappings: string[] = [
    '@base-contracts/=base-contracts/',
    '@eth-optimism-bedrock/=optimism/packages/contracts-bedrock/',
    '@gnosissafe/contracts/=safe-contracts/contracts/',
    '@openzeppelin/contracts-upgradeable/=openzeppelin-contracts-upgradeable/contracts/',
    '@openzeppelin/contracts/=openzeppelin-contracts/contracts/',
    '@rari-capital/solmate/=solmate/',
    'base-contracts/=base-contracts/',
    'ds-test/=forge-std/lib/ds-test/src/',
    'forge-std/=forge-std/src/',
    'openzeppelin-contracts-upgradeable/=openzeppelin-contracts-upgradeable/',
    'openzeppelin-contracts/=openzeppelin-contracts/',
    'optimism/=optimism/',
    'safe-contracts/=safe-contracts/contracts/',
    'solmate/=solmate/src/',
  ]

  const parsedFileManager = ParsedFileManager.parseFiles(files, remappings)
  const flattend = flattenStartingFrom(rootContractName, parsedFileManager)
  await writeFile('flattened.sol', flattend)

  process.exit(0)
}

async function listFilesRecursively(path: string): Promise<string[]> {
  const dirents = await readdir(path, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = resolve(path, dirent.name)
      return dirent.isDirectory() ? listFilesRecursively(res) : res
    }),
  )

  return files.flat()
}

export function filterOutNonSolidityFiles(files: string[]): string[] {
  return files.filter((f) => basename(f).endsWith('.sol'))
}

async function read(path: string): Promise<{ path: string; content: string }> {
  const content = await readFile(path, 'utf-8')
  return {
    path,
    content,
  }
}
