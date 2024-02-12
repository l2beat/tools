import { assert  } from '@l2beat/backend-tools'
import { ByteRange, ParsedFileManager } from './ParsedFilesManager'

export function flattenStartingFrom(rootContractName: string,
                                    parsedFileManager: ParsedFileManager): string {
    let flatSource = ''

    const rootContract =
      parsedFileManager.findContractDeclaration(rootContractName)

    flatSource = pushSource(
      flatSource,
      rootContract.file.content,
      rootContract.contract.byteRange,
    )

    // Depth first search
    const stack = rootContract.contract.inheritsFrom
      .concat(rootContract.contract.librariesUsed)
      .slice()
      .reverse()
      .map((contractName) => ({
        contractName,
        fromFile: rootContract.file,
      }))

    const visited = new Set<string>()
    while (stack.length > 0) {
      const entry = stack.pop()
      assert(entry !== undefined, 'Stack should not be empty')
      if (visited.has(`${entry.fromFile.path}-${entry.contractName}`)) {
        continue
      }
      const currentFile = entry.fromFile
      visited.add(`${currentFile.path}-${entry.contractName}`)

      const result = parsedFileManager.tryFindContract(
        entry.contractName,
        currentFile,
      )

      assert(result)
      const { contract, file } = result

      flatSource = pushSource(flatSource, file.content, contract.byteRange)
      stack.push(
        ...contract.inheritsFrom
          .map((contractName) => ({
            contractName,
            fromFile: file,
          }))
          .concat(
            contract.librariesUsed.map((contractName) => ({
              contractName,
              fromFile: file,
            })),
          ),
      )
    }

    return flatSource
}

function pushSource(acc: string, source: string, byteRange: ByteRange): string {
  return acc + source.slice(byteRange.start, byteRange.end + 1) + '\n\n'
}
