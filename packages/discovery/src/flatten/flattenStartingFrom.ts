import { assert } from '@l2beat/backend-tools'

import {
  ByteRange,
  ContractFilePair,
  ParsedFile,
  ParsedFileManager,
} from './ParsedFilesManager'

interface ContractNameFilePair {
  contractName: string
  file: ParsedFile
}

export function flattenStartingFrom(
  rootContractName: string,
  parsedFileManager: ParsedFileManager,
): string {
  const rootContract =
    parsedFileManager.findContractDeclaration(rootContractName)

  let flatSource = formatSource(
    rootContract.file.content,
    rootContract.contract.byteRange,
  )

  // Depth first search
  const visited = new Set<string>()
  const stack: ContractNameFilePair[] = getStackEntries(rootContract).reverse()
  while (stack.length > 0) {
    const entry = stack.pop()
    assert(entry !== undefined, 'Stack should not be empty')

    const uniqueContractId = getUniqueContractId(entry)
    if (visited.has(uniqueContractId)) {
      continue
    }
    visited.add(uniqueContractId)

    const foundContract = parsedFileManager.tryFindContract(
      entry.contractName,
      entry.file,
    )

    assert(foundContract, `Failed to find contract ${entry.contractName}`)
    const { contract, file } = foundContract

    flatSource += formatSource(file.content, contract.byteRange)
    stack.push(...getStackEntries(foundContract))
  }

  return flatSource
}

function formatSource(source: string, byteRange: ByteRange): string {
  return source.slice(byteRange.start, byteRange.end + 1) + '\n\n'
}

function getUniqueContractId(entry: ContractNameFilePair): string {
  return `${entry.file.path}-${entry.contractName}`
}

function getStackEntries(pair: ContractFilePair): ContractNameFilePair[] {
  const contractNames = pair.contract.inheritsFrom.concat(
    pair.contract.librariesUsed,
  )
  return contractNames.map((contractName) => ({
    contractName,
    file: pair.file,
  }))
}
