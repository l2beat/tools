import { assert, Logger } from '@l2beat/backend-tools'
import { parse } from '@solidity-parser/parser'
// TODO(radomski): The parser does not expose the AST types for SOME reason.
// Either we ignore this error or we fork the parser and expose the types.
// eslint-disable-next-line import/no-unresolved
import { UsingForDeclaration } from '@solidity-parser/parser/dist/src/ast-types'
import * as path from 'path'

type ParseResult = ReturnType<typeof parse>

interface ByteRange {
  start: number
  end: number
}

interface ContractDecl {
  inheritsFrom: string[]
  librariesUsed: string[]
  name: string
  byteRange: ByteRange
}

// If import is:
//
// import { foo as bar } from 'baz'
//
// Then:
// path: 'baz'
// originalName: 'foo'
// importedName: 'bar'
interface ImportDirective {
  path: string
  absolutePath: string
  originalName: string
  importedName: string
}

export interface FileContent {
  path: string
  content: string
}

export interface ParsedFile extends FileContent {
  ast: ParseResult

  contractDeclarations: ContractDecl[]
  importDirectives: ImportDirective[]
}

export class ContractFlattener {
  private readonly files: ParsedFile[] = []

  private readonly visitedPaths: string[] = []

  constructor(
    fileContents: FileContent[],
    private readonly remappings: string[],
    private readonly logger: Logger,
  ) {
    let elapsedMilliseconds = -Date.now()
    this.files = fileContents.map(({ path, content }) => ({
      path: this.resolveRemappings(path),
      content,
      ast: parse(content, { range: true }),
      contractDeclarations: [],
      importDirectives: [],
    }))

    elapsedMilliseconds += Date.now()
    const sourceLineCount = fileContents.reduce(
      (acc, f) => acc + f.content.split('\n').length,
      0,
    )
    const linesPerSecond = sourceLineCount / (elapsedMilliseconds / 1000)

    this.logger.info(
      `Parsed ${
        fileContents.length
      } files in ${elapsedMilliseconds}ms (${linesPerSecond.toFixed(
        0,
      )} lines/s))`,
    )

    this.isolate()
  }

  resolveRemappings(path: string): string {
    for (const remapping of this.remappings) {
      const [prefix, target] = remapping.split('=')

      assert(remapping.includes('='), 'Invalid remapping, lacking "=" sign.')
      assert(prefix !== undefined, 'Invalid remapping, missing prefix.')
      assert(target !== undefined, 'Invalid remapping, missing target.')

      if (path.startsWith(prefix)) {
        return target + path.slice(prefix.length)
      }
    }

    return path
  }

  isolate(): void {
    // Pass 1: Find all contract declarations and libraries used (only 'using' directive is supported for now)
    for (const file of this.files) {
      const contractDeclarations = file.ast.children.filter(
        (n) => n.type === 'ContractDefinition',
      )

      file.contractDeclarations = contractDeclarations.map((c) => {
        assert(c.type === 'ContractDefinition' && c.range !== undefined)

        return {
          name: c.name,
          inheritsFrom: c.baseContracts.map((bc) => bc.baseName.namePath),
          librariesUsed: c.subNodes
            .filter((sn) => sn.type === 'UsingForDeclaration')
            .map((sn) => {
              assert(sn.type === 'UsingForDeclaration')
              const usingNode = sn as UsingForDeclaration
              assert(usingNode.libraryName !== null)

              return usingNode.libraryName
            }),
          byteRange: {
            start: c.range[0],
            end: c.range[1],
          },
        }
      })
    }

    // Pass 2: Resolve all imports
    for (const file of this.files) {
      this.visitedPaths.push(file.path)
      file.importDirectives = this.resolveFileImports(file)
      this.visitedPaths.splice(0, this.visitedPaths.length)
    }
  }

  resolveFileImports(file: ParsedFile, depth = 0): ImportDirective[] {
    const importDirectives = file.ast.children.filter(
      (n) => n.type === 'ImportDirective',
    )

    // TODO(radomski): There is a problem because we are not resolving imported contracts that are two levels deep.
    // We need to recursively resolve imports, that means that we need to resolve imports in the imported files as well.
    return importDirectives.flatMap((i) => {
      assert(i.type === 'ImportDirective' && i.range !== undefined)

      const importedFile = this.resolveImportPath(file, i.path)
      if (this.visitedPaths.includes(importedFile.path)) {
        return []
      }
      this.visitedPaths.push(importedFile.path)

      if (i.symbolAliases === null) {
        // We want to import everything from the file
        return importedFile.contractDeclarations
          .map((c) => ({
            path: i.path,
            absolutePath: importedFile.path,
            originalName: c.name,
            importedName: c.name,
          }))
          .concat(this.resolveFileImports(importedFile, depth + 1))
      }

      return i.symbolAliases.map((alias) => ({
        path: i.path,
        absolutePath: importedFile.path,
        originalName: alias[0],
        importedName: alias[1] ?? alias[0],
      }))
    })
  }

  flattenStartingFrom(rootContractName: string): string {
    let result = ''

    const fileWithRootContract =
      this.findFileDeclaringContract(rootContractName)
    const rootContract = this.findContractDeclaration(
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

    while (stack.length > 0) {
      const entry = stack.pop()
      assert(entry !== undefined, 'Stack should not be empty')
      const currentFile = entry.fromFile

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
        const contract = this.findContractDeclaration(
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
        const importedFile = this.resolveImportContract(
          currentFile,
          entry.contractName,
        )

        const importedContract = this.findContractDeclaration(
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

  findFileDeclaringContract(contractName: string): ParsedFile {
    const matchingFiles = this.files.filter((f) =>
      f.contractDeclarations.some((c) => c.name === contractName),
    )

    if (matchingFiles.length !== 1) {
      console.log('findFileDeclaringContract: ', this.remappings, contractName)
    }
    assert(matchingFiles.length !== 0, 'File not found')
    assert(matchingFiles.length === 1, 'Multiple files found')
    assert(matchingFiles[0] !== undefined, 'File not found')

    return matchingFiles[0]
  }

  findContractDeclaration(
    file: ParsedFile,
    contractName: string,
  ): ContractDecl {
    const matchingContracts = file.contractDeclarations.filter(
      (c) => c.name === contractName,
    )

    if (matchingContracts.length !== 1) {
      console.log('findContractDeclaration: ', file, contractName)
    }
    assert(matchingContracts.length !== 0, 'Contract not found')
    assert(matchingContracts.length === 1, 'Multiple contracts found')
    assert(matchingContracts[0] !== undefined, 'Contract not found')

    return matchingContracts[0]
  }

  resolveImportContract(
    fromFile: ParsedFile,
    contractName: string,
  ): ParsedFile {
    const matchingImports = fromFile.importDirectives.filter(
      (c) => c.importedName === contractName,
    )

    if (matchingImports.length !== 1) {
      console.log(
        'resolveImportContract: ',
        fromFile.path,
        contractName,
        matchingImports,
      )
    }
    assert(matchingImports.length !== 0, 'Import not found')
    assert(matchingImports.length === 1, 'Multiple imports found')
    assert(matchingImports[0] !== undefined, 'Import not found')

    return this.resolveImportPath(fromFile, matchingImports[0].absolutePath)
  }

  resolveImportPath(fromFile: ParsedFile, importPath: string): ParsedFile {
    // TODO(radomski): This is the biggest unknown and I should really
    // consider if this simple string comparison will solve every single
    // possible case.
    const remappedPath = this.resolveRemappings(importPath)
    const resolvedPath = remappedPath.startsWith('.')
      ? path.join(path.dirname(fromFile.path), remappedPath)
      : remappedPath

    const matchingFiles = this.files.filter((f) =>
      pathsMatch(f.path, resolvedPath),
    )

    if (matchingFiles.length !== 1) {
      console.log('resolveImportPath: ', {
        remappings: this.remappings,
        fromFilePath: fromFile.path,
        importPath,
        remappedPath,
        resolvedPath,
        matchingFiles,
      })
    }
    assert(matchingFiles.length !== 0, 'File not found')
    assert(matchingFiles.length === 1, 'Multiple files found')
    assert(matchingFiles[0] !== undefined, 'File not found')

    return matchingFiles[0]
  }
}

function replaceAll(str: string, search: string, replacement: string): string {
  return str.split(search).join(replacement)
}

function pathsMatch(path1: string, path2: string): boolean {
  // This is better but for the demo we will use the below
  return path1 === path2

  // return (
  //   path1.endsWith(replaceAll(path.normalize(path2), '../', '')) &&
  //   path.basename(path1) === path.basename(path2)
  // )
}

function pushSource(acc: string, source: string, byteRange: ByteRange): string {
  return acc + source.slice(byteRange.start, byteRange.end + 1) + '\n\n'
}
