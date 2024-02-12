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
    let flatSource = ''

    const rootContract =
      this.parsedFileManager.findContractDeclaration(rootContractName)

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

      const result = this.parsedFileManager.tryFindContract(
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
}

function pushSource(acc: string, source: string, byteRange: ByteRange): string {
  return acc + source.slice(byteRange.start, byteRange.end + 1) + '\n\n'
}
