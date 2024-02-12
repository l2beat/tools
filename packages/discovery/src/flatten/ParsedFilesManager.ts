import { assert } from '@l2beat/backend-tools'
import { parse } from '@solidity-parser/parser'
// eslint-disable-next-line import/no-unresolved
import { ContractDefinition } from '@solidity-parser/parser/dist/src/ast-types'
import * as path from 'path'

import { getUniqueIdentifiers } from './astWalk'

type ParseResult = ReturnType<typeof parse>

export interface ByteRange {
  start: number
  end: number
}

type ContractType = 'contract' | 'interface' | 'library' | 'abstract'

interface ContractDeclaration {
  name: string
  type: ContractType

  ast: ContractDefinition
  byteRange: ByteRange

  inheritsFrom: string[]
  librariesUsed: string[]
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

  contractDeclarations: ContractDeclaration[]
  importDirectives: ImportDirective[]
}

export interface ContractFilePair {
  contract: ContractDeclaration
  file: ParsedFile
}

export class ParsedFileManager {
  private files: ParsedFile[] = []
  private remappings: string[] = []

  static parseFiles(
    files: FileContent[],
    remappings: string[],
  ): ParsedFileManager {
    const result = new ParsedFileManager()

    result.remappings = remappings
    result.files = files.map(({ path, content }) => ({
      path: result.resolveRemappings(path),
      content,
      ast: parse(content, { range: true }),
      contractDeclarations: [],
      importDirectives: [],
    }))

    // Pass 1: Find all contract declarations and libraries used (only 'using' directive is supported for now)
    for (const file of result.files) {
      const contractDeclarations = file.ast.children.filter(
        (n) => n.type === 'ContractDefinition',
      )

      file.contractDeclarations = contractDeclarations.map((c) => {
        assert(c.type === 'ContractDefinition' && c.range !== undefined)

        return {
          ast: c,
          name: c.name,
          type: c.kind as ContractType,
          inheritsFrom: c.baseContracts.map((bc) => bc.baseName.namePath),
          librariesUsed: [],
          byteRange: {
            start: c.range[0],
            end: c.range[1],
          },
        }
      })
    }

    // Pass 2: Resolve all imports
    for (const file of result.files) {
      const visitedPaths: string[] = [file.path]
      file.importDirectives = result.resolveFileImports(file, visitedPaths)
    }

    // Pass 3: Resolve all libraries used
    for (const file of result.files) {
      for (const contract of file.contractDeclarations) {
        contract.librariesUsed = result.resolveLibrariesUsed(file, contract.ast)
      }
    }

    for (const file of result.files) {
      assert(
        file.ast.children.filter((n) => n.type === 'FunctionDefinition')
          .length === 0,
      )
    }

    return result
  }

  resolveLibrariesUsed(file: ParsedFile, c: ContractDefinition): string[] {
    const path: string[] = []
    const identifiers = new Set(
      c.subNodes
        .flatMap((k) => getUniqueIdentifiers(k, path, file.content))
        .map(ParsedFileManager.extractNamespace),
    )

    const fromMagic = []
    for (const identifier of identifiers) {
      const result = this.tryFindContract(identifier, file)
      if (result !== undefined && result.contract.type === 'library') {
        fromMagic.push(identifier)
      }
    }

    return fromMagic
  }

  static extractNamespace(identifier: string): string {
    const dotIndex = identifier.indexOf('.')
    if (dotIndex === -1) {
      return identifier
    }
    return identifier.substring(0, dotIndex)
  }

  resolveFileImports(
    file: ParsedFile,
    visitedPaths: string[],
  ): ImportDirective[] {
    const importDirectives = file.ast.children.filter(
      (n) => n.type === 'ImportDirective',
    )

    return importDirectives.flatMap((i) => {
      assert(i.type === 'ImportDirective' && i.range !== undefined)

      const importedFile = this.resolveImportPath(file, i.path)
      if (visitedPaths.includes(importedFile.path)) {
        return []
      }
      visitedPaths.push(importedFile.path)

      if (i.symbolAliases === null) {
        // We want to import everything from the file
        return importedFile.contractDeclarations
          .map((c) => ({
            path: i.path,
            absolutePath: importedFile.path,
            originalName: c.name,
            importedName: c.name,
          }))
          .concat(this.resolveFileImports(importedFile, visitedPaths))
      }

      return i.symbolAliases.map((alias) => ({
        path: i.path,
        absolutePath: importedFile.path,
        originalName: alias[0],
        importedName: alias[1] ?? alias[0],
      }))
    })
  }

  tryFindContract(
    contractName: string,
    file: ParsedFile,
  ): ContractFilePair | undefined {
    const matchingContracts = file.contractDeclarations.filter(
      (c) => c.name === contractName,
    )

    if (matchingContracts.length === 1 && matchingContracts[0] !== undefined) {
      return {
        contract: matchingContracts[0],
        file,
      }
    }

    const matchingImports = file.importDirectives.filter(
      (c) => c.importedName === contractName,
    )

    if (matchingImports.length === 1 && matchingImports[0] !== undefined) {
      return this.tryFindContract(
        contractName,
        this.resolveImportPath(file, matchingImports[0].absolutePath),
      )
    }

    return undefined
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
    contractName: string,
    file?: ParsedFile,
  ): ContractFilePair {
    if (file === undefined) {
      file = this.findFileDeclaringContract(contractName)
    }

    const matchingContracts = file.contractDeclarations.filter(
      (c) => c.name === contractName,
    )

    if (matchingContracts.length !== 1) {
      console.log('findContractDeclaration: ', file, contractName)
    }
    assert(matchingContracts.length !== 0, 'Contract not found')
    assert(matchingContracts.length === 1, 'Multiple contracts found')
    assert(matchingContracts[0] !== undefined, 'Contract not found')

    return {
      contract: matchingContracts[0],
      file,
    }
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
}

function pathsMatch(path1: string, path2: string): boolean {
  return path1 === path2
}
