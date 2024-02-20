import { assert } from '@l2beat/backend-tools'
import { parse } from '@solidity-parser/parser'
// eslint-disable-next-line import/no-unresolved
import { ContractDefinition } from '@solidity-parser/parser/dist/src/ast-types'
import * as posix from 'path'

import { getASTIdentifiers } from './getASTIdentifiers'

type ParseResult = ReturnType<typeof parse>

export interface ByteRange {
  start: number
  end: number
}

type ContractType = 'contract' | 'interface' | 'library' | 'abstract'

export interface ContractDeclaration {
  name: string
  type: ContractType

  ast: ContractDefinition
  byteRange: ByteRange

  inheritsFrom: string[]
  referencedContracts: string[]
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
  absolutePath: string
  originalName: string
  importedName: string
}

export interface FileContent {
  path: string
  content: string
}

export interface Remapping {
  prefix: string
  target: string
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

export class ParsedFilesManager {
  private files: ParsedFile[] = []

  static parseFiles(
    files: FileContent[],
    remappingStrings: string[],
  ): ParsedFilesManager {
    const result = new ParsedFilesManager()
    const remappings = decodeRemappings(remappingStrings)

    result.files = files.map(({ path, content }) => ({
      path: resolveRemappings(path, remappings),
      content,
      ast: parse(content, { range: true }),
      contractDeclarations: [],
      importDirectives: [],
    }))

    // Pass 1: Find all contract declarations
    for (const file of result.files) {
      file.contractDeclarations = result.resolveContractDeclarations(file)
    }

    // Pass 2: Resolve all imports
    for (const file of result.files) {
      const alreadyImportedObjects = new Map<string, string[]>()
      alreadyImportedObjects.set(
        file.path,
        file.contractDeclarations.map((c) => c.name),
      )

      file.importDirectives = result.resolveFileImports(
        file,
        remappings,
        alreadyImportedObjects,
      )
    }

    // Pass 3: Resolve all references to other contracts
    for (const file of result.files) {
      for (const contract of file.contractDeclarations) {
        contract.referencedContracts = result.resolveReferencedContracts(
          file,
          contract.ast,
        )
      }
    }

    for (const file of result.files) {
      const areTopLevelPresent =
        file.ast.children.filter((n) => n.type === 'FunctionDefinition')
          .length !== 0
      assert(!areTopLevelPresent, 'Function definitions are not supported')
    }

    return result
  }

  resolveContractDeclarations(file: ParsedFile): ContractDeclaration[] {
    const contractDeclarations = file.ast.children.filter(
      (n) => n.type === 'ContractDefinition',
    )

    return contractDeclarations.map((c) => {
      assert(c.range !== undefined, 'Invalid contract definition')
      const declaration = c as ContractDefinition

      return {
        ast: declaration,
        name: declaration.name,
        type: declaration.kind as ContractType,
        inheritsFrom: declaration.baseContracts.map(
          (bc) => bc.baseName.namePath,
        ),
        referencedContracts: [],
        byteRange: {
          start: c.range[0],
          end: c.range[1],
        },
      }
    })
  }

  resolveReferencedContracts(
    file: ParsedFile,
    c: ContractDefinition,
  ): string[] {
    const identifiers = new Set(
      c.subNodes.flatMap((n) => getASTIdentifiers(n)).map(extractNamespace),
    )

    const referenced = []
    for (const identifier of identifiers) {
      const result = this.tryFindContract(identifier, file)
      if (result !== undefined && result.contract.type === 'library') {
        referenced.push(identifier)
      }
    }

    return referenced
  }

  resolveFileImports(
    file: ParsedFile,
    remappings: Remapping[],
    alreadyImportedObjects: Map<string, string[]>,
  ): ImportDirective[] {
    const importDirectives = file.ast.children.filter(
      (n) => n.type === 'ImportDirective',
    )

    return importDirectives.flatMap((i) => {
      assert(
        i.type === 'ImportDirective' && i.range !== undefined,
        'Invalid import directive',
      )

      const remappedPath = resolveRemappings(i.path, remappings)
      const importedFile = this.resolveImportPath(file, remappedPath)

      const alreadyImported =
        alreadyImportedObjects.get(importedFile.path) ?? []
      assert(
        alreadyImported.length <= importedFile.contractDeclarations.length,
        'Already imported more than there are contracts in the file',
      )
      if (alreadyImported.length === importedFile.contractDeclarations.length) {
        return []
      }

      const result = []
      const importEverything = i.symbolAliases === null
      if (importEverything) {
        for (const contract of importedFile.contractDeclarations) {
          const object = {
            absolutePath: importedFile.path,
            originalName: contract.name,
            importedName: contract.name,
          }

          if (!alreadyImported.includes(object.originalName)) {
            result.push(object)
          }
        }

        alreadyImportedObjects.set(
          importedFile.path,
          importedFile.contractDeclarations.map((c) => c.name),
        )

        const recursiveResult = this.resolveFileImports(
          importedFile,
          remappings,
          alreadyImportedObjects,
        )
        return result.concat(recursiveResult)
      }

      assert(i.symbolAliases !== null, 'Invalid import directive')
      for (const alias of i.symbolAliases) {
        const object = {
          absolutePath: importedFile.path,
          originalName: alias[0],
          importedName: alias[1] ?? alias[0],
        }

        if (alreadyImported.includes(object.originalName)) {
          continue
        }

        alreadyImportedObjects.set(importedFile.path, [
          ...alreadyImported,
          object.originalName,
        ])

        result.push(object)
      }

      return result
    })
  }

  tryFindContract(
    contractName: string,
    file: ParsedFile,
  ): ContractFilePair | undefined {
    const matchingContract = findOne(
      file.contractDeclarations,
      (c) => c.name === contractName,
    )

    if (matchingContract !== undefined) {
      return {
        contract: matchingContract,
        file,
      }
    }

    const matchingImport = findOne(
      file.importDirectives,
      (c) => c.importedName === contractName,
    )

    if (matchingImport !== undefined) {
      return this.tryFindContract(
        matchingImport.originalName,
        this.resolveImportPath(file, matchingImport.absolutePath),
      )
    }

    return undefined
  }

  findFileDeclaringContract(contractName: string): ParsedFile {
    const matchingFile = findOne(this.files, (f) =>
      f.contractDeclarations.some((c) => c.name === contractName),
    )
    assert(
      matchingFile !== undefined,
      `Failed to find file declaring contract ${contractName}`,
    )

    return matchingFile
  }

  findContractDeclaration(
    contractName: string,
    file?: ParsedFile,
  ): ContractFilePair {
    file ??= this.findFileDeclaringContract(contractName)

    const matchingContract = findOne(
      file.contractDeclarations,
      (c) => c.name === contractName,
    )
    assert(matchingContract !== undefined, 'Contract not found')

    return {
      contract: matchingContract,
      file,
    }
  }

  resolveImportPath(fromFile: ParsedFile, importPath: string): ParsedFile {
    const resolvedPath = importPath.startsWith('.')
      ? posix.join(posix.dirname(fromFile.path), importPath)
      : importPath

    const matchingFile = findOne(this.files, (f) => f.path === resolvedPath)
    assert(matchingFile !== undefined, 'File not found')

    return matchingFile
  }
}

function extractNamespace(identifier: string): string {
  const dotIndex = identifier.indexOf('.')
  if (dotIndex === -1) {
    return identifier
  }
  return identifier.substring(0, dotIndex)
}

function decodeRemappings(remappingStrings: string[]): Remapping[] {
  return remappingStrings.map((r) => {
    const [prefix, target] = r.split('=')

    assert(r.includes('='), 'Invalid remapping, lacking "=" sign.')
    assert(prefix !== undefined, 'Invalid remapping, missing prefix.')
    assert(target !== undefined, 'Invalid remapping, missing target.')
    return { prefix, target }
  })
}

function resolveRemappings(path: string, remappings: Remapping[]): string {
  const matchingRemappings = remappings.filter((r) => path.startsWith(r.prefix))
  if (matchingRemappings.length > 0) {
    const longest = matchingRemappings.reduce((a, b) =>
      a.prefix.length > b.prefix.length ? a : b,
    )

    return posix.join(longest.target, path.slice(longest.prefix.length))
  }

  return path
}

function findOne<T>(
  array: T[],
  predicate: (item: T) => boolean,
): T | undefined {
  const matching = array.filter(predicate)

  if (matching.length === 1 && matching[0] !== undefined) {
    return matching[0]
  }

  return undefined
}
