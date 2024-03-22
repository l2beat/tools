import { assert } from '@l2beat/backend-tools'
import { parse } from '@solidity-parser/parser'
// eslint-disable-next-line import/no-unresolved
import {
  ASTNode,
  BaseASTNode,
  ContractDefinition,
  EnumDefinition,
  FunctionDefinition,
  StructDefinition,
  TypeDefinition,
} from '@solidity-parser/parser/dist/src/ast-types'
import * as posix from 'path'

import { getASTIdentifiers } from './getASTIdentifiers'

type ParseResult = ReturnType<typeof parse>

export interface ByteRange {
  start: number
  end: number
}

type DeclarationType =
  | 'contract'
  | 'interface'
  | 'library'
  | 'abstract'
  | 'struct'
  | 'function'
  | 'typedef'
  | 'enum'

export interface TopLevelDeclaration {
  name: string
  type: DeclarationType

  ast: ASTNode
  byteRange: ByteRange

  inheritsFrom: string[]
  referencedDeclaration: string[]
}

// If import is:
//
// import { foo as bar } from 'baz'
//
// Then:
// absolutePath: 'baz'
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
  context: string
  prefix: string
  target: string
}

export interface ParsedFile extends FileContent {
  rootASTNode: ParseResult

  topLevelDeclarations: TopLevelDeclaration[]
  importDirectives: ImportDirective[]
}

export interface DeclarationFilePair {
  declaration: TopLevelDeclaration
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
      rootASTNode: parse(content, { range: true }),
      topLevelDeclarations: [],
      importDirectives: [],
    }))

    // Pass 1: Find all contract declarations
    for (const file of result.files) {
      file.topLevelDeclarations = result.resolveTopLevelDeclarations(file)
    }

    // Pass 2: Resolve all imports
    for (const file of result.files) {
      const alreadyImportedObjects = new Map<string, string[]>()
      alreadyImportedObjects.set(
        file.path,
        file.topLevelDeclarations.map((c) => c.name),
      )

      file.importDirectives = result.resolveFileImports(
        file,
        remappings,
        alreadyImportedObjects,
      )
    }

    // Pass 3: Resolve all references to other contracts
    for (const file of result.files) {
      for (const declaration of file.topLevelDeclarations) {
        declaration.referencedDeclaration = result.resolveReferencedLibraries(
          file,
          declaration.ast,
        )
      }
    }

    return result
  }

  private resolveTopLevelDeclarations(file: ParsedFile): TopLevelDeclaration[] {
    const contractDeclarations = file.rootASTNode.children.filter(
      (n) => n.type === 'ContractDefinition',
    )

    const contracts: TopLevelDeclaration[] = contractDeclarations.map((c) => {
      assert(c.range !== undefined, 'Invalid contract definition')
      const declaration = c as ContractDefinition

      return {
        ast: declaration,
        name: declaration.name,
        type: declaration.kind as DeclarationType,
        inheritsFrom: declaration.baseContracts.map(
          (bc) => bc.baseName.namePath,
        ),
        referencedDeclaration: [],
        byteRange: {
          start: c.range[0],
          end: c.range[1],
        },
      }
    })

    const structDeclarations = file.rootASTNode.children.filter(
      (n) => n.type === 'StructDefinition',
    )

    const structrues: TopLevelDeclaration[] = structDeclarations.map((c) => {
      assert(c.range !== undefined, 'Invalid contract definition')
      const declaration = c as StructDefinition

      return {
        ast: declaration,
        name: declaration.name,
        type: 'struct' as DeclarationType,
        inheritsFrom: [] as string[],
        referencedDeclaration: [],
        byteRange: {
          start: c.range[0],
          end: c.range[1],
        },
      }
    })

    const functionDeclaration = file.rootASTNode.children.filter(
      (n) => n.type === 'FunctionDefinition',
    )

    const functions: TopLevelDeclaration[] = functionDeclaration.map((c) => {
      assert(c.range !== undefined, 'Invalid contract definition')
      const declaration = c as FunctionDefinition

      return {
        ast: declaration,
        name: declaration.name ?? '',
        type: 'function' as DeclarationType,
        inheritsFrom: [] as string[],
        referencedDeclaration: [],
        byteRange: {
          start: c.range[0],
          end: c.range[1],
        },
      }
    })

    const typedefDeclaration = file.rootASTNode.children.filter(
      (n) => n.type === 'TypeDefinition',
    )

    const typedefs: TopLevelDeclaration[] = typedefDeclaration.map((c) => {
      assert(c.range !== undefined, 'Invalid contract definition')
      const declaration = c as TypeDefinition

      return {
        ast: declaration,
        name: declaration.name,
        type: 'typedef' as DeclarationType,
        inheritsFrom: [] as string[],
        referencedDeclaration: [],
        byteRange: {
          start: c.range[0],
          end: c.range[1],
        },
      }
    })

    const enumDeclaration = file.rootASTNode.children.filter(
      (n) => n.type === 'EnumDefinition',
    )

    const enums: TopLevelDeclaration[] = enumDeclaration.map((c) => {
      assert(c.range !== undefined, 'Invalid contract definition')
      const declaration = c as EnumDefinition

      return {
        ast: declaration,
        name: declaration.name,
        type: 'enum' as DeclarationType,
        inheritsFrom: [] as string[],
        referencedDeclaration: [],
        byteRange: {
          start: c.range[0],
          end: c.range[1],
        },
      }
    })

    return contracts
      .concat(structrues)
      .concat(functions)
      .concat(typedefs)
      .concat(enums)
  }

  private resolveFileImports(
    file: ParsedFile,
    remappings: Remapping[],
    alreadyImportedObjects: Map<string, string[]>,
  ): ImportDirective[] {
    const importDirectives = file.rootASTNode.children.filter(
      (n) => n.type === 'ImportDirective',
    )

    return importDirectives.flatMap((i) => {
      assert(
        i.type === 'ImportDirective' && i.range !== undefined,
        'Invalid import directive',
      )

      const remappedPath = resolveImportRemappings(
        i.path,
        remappings,
        file.path,
      )
      const importedFile = this.resolveImportPath(file, remappedPath)

      let alreadyImported = alreadyImportedObjects.get(importedFile.path)
      if (alreadyImported !== undefined) {
        assert(
          alreadyImported.length <= importedFile.topLevelDeclarations.length,
          'Already imported more than there are contracts in the file',
        )
        const gotEverything =
          alreadyImported.length === importedFile.topLevelDeclarations.length
        if (gotEverything) {
          return []
        }
      }
      alreadyImported ??= []

      const result = []
      const importEverything = i.symbolAliases === null
      if (importEverything) {
        for (const declaration of importedFile.topLevelDeclarations) {
          const object = {
            absolutePath: importedFile.path,
            originalName: declaration.name,
            importedName: declaration.name,
          }

          if (!alreadyImported.includes(object.originalName)) {
            result.push(object)
          }
        }

        alreadyImportedObjects.set(
          importedFile.path,
          importedFile.topLevelDeclarations.map((c) => c.name),
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

        const isAlreadyImported = alreadyImported.includes(object.originalName)
        if (isAlreadyImported) {
          continue
        }

        const isDeclared = importedFile.topLevelDeclarations.some(
          (c) => c.name === object.originalName,
        )
        let isImported = false
        if (!isDeclared) {
          const recursiveResult = this.resolveFileImports(
            importedFile,
            remappings,
            alreadyImportedObjects,
          )

          isImported = recursiveResult.some(
            (id) => id.originalName === object.originalName,
          )
        }

        if (isDeclared || isImported) {
          alreadyImported.push(object.originalName)
          result.push(object)
        }
      }

      alreadyImportedObjects.set(importedFile.path, alreadyImported)

      return result
    })
  }

  private resolveReferencedLibraries(file: ParsedFile, c: ASTNode): string[] {
    let subNodes: BaseASTNode[] = []
    if (c.type === 'ContractDefinition') {
      subNodes = c.subNodes
    } else if (c.type === 'StructDefinition') {
      subNodes = c.members
    } else if (c.type === 'FunctionDefinition') {
      subNodes = c.body ? [c.body] : []
    } else if (c.type === 'TypeDefinition') {
      subNodes = []
    } else if (c.type === 'EnumDefinition') {
      subNodes = c.members
    } else {
      throw new Error('Invalid node type')
    }

    const identifiers = new Set(
      subNodes.flatMap((n) => getASTIdentifiers(n)).map(extractNamespace),
    )

    const referenced = []
    for (const identifier of identifiers) {
      const result = this.tryFindDeclaration(identifier, file)
      const isLibrary =
        result !== undefined && result.declaration.type === 'library'
      const isStruct =
        result !== undefined && result.declaration.type === 'struct'
      const isFunction =
        result !== undefined && result.declaration.type === 'function'
      const isTypedef =
        result !== undefined && result.declaration.type === 'typedef'
      const isEnum = result !== undefined && result.declaration.type === 'enum'
      if (
        result !== undefined &&
        (isLibrary || isStruct || isFunction || isTypedef || isEnum)
      ) {
        referenced.push(identifier)
      }
    }

    return referenced
  }

  tryFindDeclaration(
    declarationName: string,
    file: ParsedFile,
  ): DeclarationFilePair | undefined {
    const matchingDeclaration = findOne(
      file.topLevelDeclarations,
      (c) => c.name === declarationName,
    )

    if (matchingDeclaration !== undefined) {
      return {
        declaration: matchingDeclaration,
        file,
      }
    }

    const matchingImport = findOne(
      file.importDirectives,
      (c) => c.importedName === declarationName,
    )

    if (matchingImport !== undefined) {
      return this.tryFindDeclaration(
        matchingImport.originalName,
        this.resolveImportPath(file, matchingImport.absolutePath),
      )
    }

    return undefined
  }

  findFileDeclaring(declarationName: string): ParsedFile {
    const matchingFile = findOne(this.files, (f) =>
      f.topLevelDeclarations.some((c) => c.name === declarationName),
    )
    assert(
      matchingFile !== undefined,
      `Failed to find file declaring ${declarationName}`,
    )

    return matchingFile
  }

  findDeclaration(
    declarationName: string,
    file?: ParsedFile,
  ): DeclarationFilePair {
    file ??= this.findFileDeclaring(declarationName)

    const matchingDeclaration = findOne(
      file.topLevelDeclarations,
      (c) => c.name === declarationName,
    )
    assert(matchingDeclaration !== undefined, 'Declaration not found')

    return {
      declaration: matchingDeclaration,
      file,
    }
  }

  private resolveImportPath(
    fromFile: ParsedFile,
    importPath: string,
  ): ParsedFile {
    const resolvedPath =
      importPath.startsWith('./') || importPath.startsWith('../')
        ? posix.join(posix.dirname(fromFile.path), importPath)
        : importPath

    const matchingFile = findOne(
      this.files,
      (f) => posix.normalize(f.path) === posix.normalize(resolvedPath),
    )
    assert(
      matchingFile !== undefined,
      `File [${fromFile.path}][${resolvedPath}] not found`,
    )

    return matchingFile
  }
}

// Takes a user defined type name such as `MyLibrary.MyStructInLibrary` and
// returns only the namespace - the part before the dot.
function extractNamespace(identifier: string): string {
  const dotIndex = identifier.indexOf('.')
  if (dotIndex === -1) {
    return identifier
  }
  return identifier.substring(0, dotIndex)
}

function decodeRemappings(remappingStrings: string[]): Remapping[] {
  return remappingStrings.map((r) => {
    assert(r.includes('='), 'Invalid remapping, lacking "=" sign.')

    const [contextPrefix, target] = r.split('=')
    assert(contextPrefix !== undefined, 'Invalid remapping, missing prefix.')

    let context = undefined
    let prefix: string | undefined = contextPrefix
    if (contextPrefix.includes(':')) {
      ;[context, prefix] = contextPrefix.split(':')
    }
    context ??= ''

    assert(prefix !== undefined, 'Invalid remapping, missing prefix.')
    assert(target !== undefined, 'Invalid remapping, missing target.')
    return { context, prefix, target }
  })
}

function resolveRemappings(path: string, remappings: Remapping[]): string {
  const matchingRemappings = remappings.filter((r) => path.startsWith(r.prefix))
  if (matchingRemappings.length > 0) {
    const longest = matchingRemappings.reduce((a, b) =>
      a.prefix.length > b.prefix.length ? a : b,
    )

    const result = posix.join(longest.target, path.slice(longest.prefix.length))
    return result
  }

  return path
}

function resolveImportRemappings(
  path: string,
  remappings: Remapping[],
  context: string,
): string {
  let longestPrefix = 0
  let longestContext = 0
  let longest: Remapping | undefined = undefined

  for (const remapping of remappings) {
    const isSmallerContext = remapping.context.length < longestContext
    if (isSmallerContext) {
      continue
    }
    const isContextPrefix = context.startsWith(remapping.context)
    if (!isContextPrefix) {
      continue
    }
    const isSmallerPrefix =
      remapping.prefix.length < longestPrefix &&
      remapping.context.length === longestContext
    if (isSmallerPrefix) {
      continue
    }
    const isPrefixMatch = path.startsWith(remapping.prefix)
    if (!isPrefixMatch) {
      continue
    }

    longestContext = remapping.context.length
    longestPrefix = remapping.prefix.length
    longest = remapping
  }

  if (longest === undefined) {
    return path
  }

  const result = posix.join(longest.target, path.slice(longest.prefix.length))
  return result
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
