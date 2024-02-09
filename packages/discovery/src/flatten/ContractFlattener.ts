import { assert, Logger } from '@l2beat/backend-tools'
import { parse } from '@solidity-parser/parser'
// TODO(radomski): The parser does not expose the AST types for SOME reason.
// Either we ignore this error or we fork the parser and expose the types.
// eslint-disable-next-line import/no-unresolved
import {
  BaseASTNode,
  ContractDefinition,
  CustomErrorDefinition,
  EventDefinition,
  Expression,
  Block,
  EmitStatement,
  ExpressionStatement,
  TypeDefinition,
  RevertStatement,
  IndexRangeAccess,
  TypeName,
  IfStatement,
  Identifier,
  VariableDeclarationStatement,
  ReturnStatement,
  VariableDeclaration,
  ModifierDefinition,
  StateVariableDeclaration,
  StructDefinition,
  UsingForDeclaration,
} from '@solidity-parser/parser/dist/src/ast-types'
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
          librariesUsed: this.resolveLibrariesUsed(file, c),
          byteRange: {
            start: c.range[0],
            end: c.range[1],
          },
        }
      })
    }

    // Pass 2: Resolve all imports
    for (const file of this.files) {
      const visitedPaths: string[] = [file.path]
      file.importDirectives = this.resolveFileImports(file, visitedPaths)
    }
  }

  resolveLibrariesUsed(file: ParsedFile, c: ContractDefinition): string[] {
    const fromUsingDirectives = c.subNodes
      .filter((sn) => sn.type === 'UsingForDeclaration')
      .map((sn) => {
        assert(sn.type === 'UsingForDeclaration')
        const usingNode = sn as UsingForDeclaration
        assert(usingNode.libraryName !== null)

        return usingNode.libraryName
      })

    let path: string[] = []
    let idents = c.subNodes.flatMap((k) =>
      searchForLibraries(k, path, file.content),
    )
    console.log(new Set(idents))

    return fromUsingDirectives
  }

  // There are two parts to this equation:
  // 1. If the library has a function and we use it, we need to find the
  // identifier in a function call
  // 2. If the library has a type we need to find the typename and resolve that
  // This is a little bit stupid because the type name is for example
  // "MyLibrary.MyStruct", that means we need to check if the typename has a
  // dot inside.
  // 2.1 If it has a dot, it really means that it's from a library. A basic
  // struct can't have a dot in it's name.
  // 2.2 There cannot be multiple dots, since we can't declare a type inside a
  // type. "MyLibrary1.MyLibrary2.MyStruct" would use both libraries but it's
  // impossible to do(?).

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

// function replaceAll(str: string, search: string, replacement: string): string {
//   return str.split(search).join(replacement)
// }

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

function searchForLibraries(
  node: BaseASTNode | null,
  path: string[],
  content: string,
): string[] {
  if (node === null) {
    return []
  }

  assert(node.range !== undefined)
  path.push(
    '\n-----------------------------------------------------\n' +
      content.slice(node.range[0], node.range[1] + 1) +
      '\n-----------------------------------------------------\n',
  )

  switch (node.type) {
    case 'Identifier': {
      return [(node as Identifier).name]
    }
    case 'VariableDeclaration': {
      // TODO(radomski): Decode the type, see if it contains a dot, if
      // it does, check if it's a library
      const decl = node as VariableDeclaration
      const ident = decl.identifier !== null ? [decl.identifier.name] : []
      const expr = parseExpression(decl.expression, path, content)
      const typeName = parseTypeName(decl.typeName)
      return expr.concat(ident).concat(typeName)
    }
    case 'Block': {
      const block = node as Block
      return block.statements.flatMap((statement) =>
        searchForLibraries(statement, path, content),
      )
    }
    case 'InlineAssemblyStatement': {
      return []
    }
    case 'RevertStatement': {
      const revertStatement = node as RevertStatement
      return parseExpression(revertStatement.revertCall, path, content)
    }
    case 'IfStatement': {
      const ifStatement = node as IfStatement
      const condition = parseExpression(ifStatement.condition, path, content)
      const trueBody = searchForLibraries(ifStatement.trueBody, path, content)
      const falseBody = searchForLibraries(ifStatement.falseBody, path, content)

      return condition.concat(trueBody).concat(falseBody)
    }
    case 'ExpressionStatement': {
      const expressionStatement = node as ExpressionStatement
      return parseExpression(expressionStatement.expression, path, content)
    }
    case 'CustomErrorDefinition': {
      return (node as CustomErrorDefinition).parameters.flatMap((p) =>
        searchForLibraries(p, path, content),
      )
    }
    case 'EventDefinition': {
      return (node as EventDefinition).parameters.flatMap((p) =>
        searchForLibraries(p, path, content),
      )
    }
    case 'FunctionDefinition': {
      return (node as EventDefinition).parameters.flatMap((p) =>
        searchForLibraries(p, path, content),
      )
    }
    case 'ModifierDefinition': {
      const mod = node as ModifierDefinition
      const params = mod.parameters ?? []

      const paramTypes = params.flatMap((p) =>
        searchForLibraries(p, path, content),
      )
      const librariesFromBlock = searchForLibraries(mod.body, path, content)

      return paramTypes.concat(librariesFromBlock)
    }
    case 'VariableDeclarationStatement': {
      const declaration = node as VariableDeclarationStatement

      const variables = declaration.variables.flatMap((v) =>
        searchForLibraries(v, path, content),
      )
      const initialValue = parseExpression(
        declaration.initialValue,
        path,
        content,
      )

      return variables.concat(initialValue)
    }
    case 'StateVariableDeclaration': {
      const decl = node as StateVariableDeclaration

      const varTypes = decl.variables.flatMap((v) =>
        searchForLibraries(v, path, content),
      )
      const expr = parseExpression(decl.initialValue, path, content)

      return expr.concat(varTypes)
    }
    case 'StructDefinition': {
      return (node as StructDefinition).members.flatMap((m) =>
        searchForLibraries(m, path, content),
      )
    }
    case 'ReturnStatement': {
      const returnStatement = node as ReturnStatement
      return parseExpression(returnStatement.expression, path, content)
    }
    case 'EmitStatement': {
      const emitStatement = node as EmitStatement
      return parseExpression(emitStatement.eventCall, path, content)
    }
    case 'BinaryOperation': {
      return parseExpression(node as Expression, path, content)
    }
    case 'EnumDefinition': {
      return []
    }
    case 'TypeDefinition': {
      const typeDefinition = node as TypeDefinition
      return parseTypeName(typeDefinition.definition)
    }
    case 'UsingForDeclaration': {
      // NOTE(radomski): We might actually want to use this in the future
      return []
    }
    case 'IndexAccess':
    case 'IndexRangeAccess':
    case 'TupleExpression':
    case 'BinaryOperation':
    case 'Conditional':
    case 'MemberAccess':
    case 'FunctionCall':
    case 'UnaryOperation':
    case 'NewExpression':
    case 'NameValueExpression': {
      return parseExpression(node as Expression, path, content)
    }
    case 'ElementaryTypeName':
    case 'UserDefinedTypeName':
    case 'Mapping':
    case 'ArrayTypeName':
    case 'FunctionTypeName': {
      return parseTypeName(node as TypeName)
    }
    default: {
      throw new Error(
        `TopLevelFunc: Unknown node type: [${node.type}] [${path.join(
          ' -> \n',
        )}]}]`,
      )
    }
  }
}

function parseExpression(
  expr: Expression | null,
  path: string[],
  content: string,
): string[] {
  if (!expr || !expr.type) {
    return []
  }

  assert(expr.range !== undefined)
  path.push(
    '\n-----------------------------------------------------\n' +
      content.slice(expr.range[0], expr.range[1] + 1) +
      '\n-----------------------------------------------------\n',
  )

  switch (expr.type) {
    case 'BinaryOperation': {
      return parseExpression(expr.left, path, content).concat(
        parseExpression(expr.right, path, content),
      )
    }
    case 'FunctionCall': {
      return parseExpression(expr.expression, path, content)
        .concat(
          expr.arguments.flatMap((k) => parseExpression(k, path, content)),
        )
        .concat(expr.identifiers.map((i) => i.name))
    }
    case 'IndexAccess': {
      return parseExpression(expr.base, path, content).concat(
        parseExpression(expr.index, path, content),
      )
    }
    case 'TupleExpression': {
      return expr.components.flatMap((component) =>
        searchForLibraries(component, path, content),
      )
    }
    case 'MemberAccess': {
      return parseExpression(expr.expression, path, content)
    }
    case 'Conditional': {
      return parseExpression(expr.condition, path, content)
        .concat(parseExpression(expr.trueExpression, path, content))
        .concat(parseExpression(expr.falseExpression, path, content))
    }
    case 'Identifier': {
      return [expr.name]
    }
    case 'NewExpression': {
      return parseTypeName(expr.typeName)
    }
    case 'UnaryOperation': {
      return parseExpression(expr.subExpression, path, content)
    }
    case 'IndexRangeAccess': {
      const base = parseExpression(expr.base, path, content)
      const indexStart = parseExpression(expr.indexStart ?? null, path, content)
      const indexEnd = parseExpression(expr.indexEnd ?? null, path, content)

      return base.concat(indexStart).concat(indexEnd)
    }
    case 'NumberLiteral': {
      return []
    }
    case 'BooleanLiteral': {
      return []
    }
    case 'HexLiteral': {
      return []
    }
    case 'StringLiteral': {
      return []
    }
    case 'ElementaryTypeName': {
      return parseTypeName(expr)
    }
    default: {
      throw new Error(
        `parseExpression: Unknown expression type: [${expr.type}] [${path.join(
          ' -> \n',
        )}]}]`,
      )
    }
  }
}

function parseTypeName(type: TypeName | null): string[] {
  if (!type || !type.type) {
    return []
  }

  switch (type.type) {
    case 'ElementaryTypeName': {
      return [type.name]
    }
    case 'UserDefinedTypeName': {
      // NOTE(radomski): Parse the dot here?
      return [type.namePath]
    }
    case 'Mapping': {
      return parseTypeName(type.keyType).concat(parseTypeName(type.valueType))
    }
    case 'ArrayTypeName': {
      return parseTypeName(type.baseTypeName)
    }
    case 'FunctionTypeName': {
      // NOTE(radomski): I think this is useless
      return []
    }
  }
}
