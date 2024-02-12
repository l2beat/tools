import { assert, Logger } from '@l2beat/backend-tools'
import { ByteRange, FileContent, ParsedFileManager } from './ParsedFilesManager'

export class ContractFlattener {
  private readonly parsedFileManager: ParsedFileManager
  constructor(
    files: FileContent[],
    private readonly remappings: string[],
    private readonly logger: Logger,
  ) {
    this.parsedFileManager = new ParsedFileManager()
    this.parsedFileManager.parseFiles(files, remappings)

    // let elapsedMilliseconds = -Date.now()

    // elapsedMilliseconds += Date.now()
    // const sourceLineCount = fileContents.reduce(
    //   (acc, f) => acc + f.content.split('\n').length,
    //   0,
    // )
    // const linesPerSecond = sourceLineCount / (elapsedMilliseconds / 1000)

    // this.logger.info(
    //   `Parsed ${
    //     fileContents.length
    //   } files in ${elapsedMilliseconds}ms (${linesPerSecond.toFixed(
    //     0,
    //   )} lines/s))`,
    // )
  }

  flattenStartingFrom(rootContractName: string): string {
    let result = ''

    const fileWithRootContract =
      this.parsedFileManager.findFileDeclaringContract(rootContractName)
    const rootContract = this.parsedFileManager.findContractDeclaration(
      fileWithRootContract,
      rootContractName,
    )

    result = pushSource(
      result,
      fileWithRootContract.content,
      rootContract.byteRange,
    )

    // Depth first search
    const stack = rootContract.inheritsFrom
      .concat(rootContract.librariesUsed)
      .slice()
      .reverse()
      .map((contractName) => ({
        contractName,
        fromFile: fileWithRootContract,
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

      const isDeclared = currentFile.contractDeclarations.some(
        (c) => c.name === entry.contractName,
      )
      const isImported = currentFile.importDirectives.some(
        (c) => c.importedName === entry.contractName,
      )

      if (!isDeclared && !isImported) {
        console.log(
          'flattenStartingFrom: ',
          currentFile.path,
          entry.contractName,
        )
      }
      assert(
        isDeclared || isImported,
        'Contract not found, neither declared nor imported',
      )
      assert(!(isDeclared && isImported), 'Contract found in multiple files')

      if (isDeclared) {
        const contract = this.parsedFileManager.findContractDeclaration(
          currentFile,
          entry.contractName,
        )

        result = pushSource(result, currentFile.content, contract.byteRange)
        stack.push(
          ...contract.inheritsFrom
            .map((contractName) => ({
              contractName,
              fromFile: currentFile,
            }))
            .concat(
              contract.librariesUsed.map((contractName) => ({
                contractName,
                fromFile: currentFile,
              })),
            ),
        )
      } else {
        const importedFile = this.parsedFileManager.resolveImportContract(
          currentFile,
          entry.contractName,
        )

        const importedContract = this.parsedFileManager.findContractDeclaration(
          importedFile,
          entry.contractName,
        )

        result = pushSource(
          result,
          importedFile.content,
          importedContract.byteRange,
        )
        stack.push(
          ...importedContract.inheritsFrom
            .map((contractName) => ({
              contractName,
              fromFile: importedFile,
            }))
            .concat(
              importedContract.librariesUsed.map((contractName) => ({
                contractName,
                fromFile: importedFile,
              })),
            ),
        )
      }
    }

    return result
  }
}

function pushSource(acc: string, source: string, byteRange: ByteRange): string {
  return acc + source.slice(byteRange.start, byteRange.end + 1) + '\n\n'
}
