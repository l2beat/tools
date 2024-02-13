// TODO(radomski): The parser does not expose the AST types for SOME reason.
// Either we ignore this error or we fork the parser and expose the types.
/* eslint-disable import/no-unresolved */
import {
  BaseASTNode,
  Block,
  CatchClause,
  ContractDefinition,
  CustomErrorDefinition,
  EmitStatement,
  EventDefinition,
  Expression,
  ExpressionStatement,
  ForStatement,
  FunctionDefinition,
  Identifier,
  IfStatement,
  InheritanceSpecifier,
  ModifierDefinition,
  NameValueList,
  ReturnStatement,
  RevertStatement,
  StateVariableDeclaration,
  StructDefinition,
  TryStatement,
  TypeDefinition,
  TypeName,
  UncheckedStatement,
  UsingForDeclaration,
  VariableDeclaration,
  VariableDeclarationStatement,
  WhileStatement,
} from '@solidity-parser/parser/dist/src/ast-types'
/* eslint-enable */

export function getASTIdentifiers(node: BaseASTNode | null): string[] {
  if (node === null) {
    return []
  }

  switch (node.type) {
    case 'Identifier': {
      return [(node as Identifier).name]
    }
    case 'VariableDeclaration': {
      const decl = node as VariableDeclaration
      const ident = decl.identifier !== null ? [decl.identifier.name] : []
      const expr = parseExpression(decl.expression)
      const typeName = parseTypeName(decl.typeName)
      return expr.concat(ident).concat(typeName)
    }
    case 'Block': {
      const block = node as Block
      return block.statements.flatMap((statement) =>
        getASTIdentifiers(statement),
      )
    }
    case 'BreakStatement':
    case 'InlineAssemblyStatement': {
      return []
    }
    case 'RevertStatement': {
      const revertStatement = node as RevertStatement
      return parseExpression(revertStatement.revertCall)
    }
    case 'IfStatement': {
      const ifStatement = node as IfStatement
      const condition = parseExpression(ifStatement.condition)
      const trueBody = getASTIdentifiers(ifStatement.trueBody)
      const falseBody = getASTIdentifiers(ifStatement.falseBody)

      return condition.concat(trueBody).concat(falseBody)
    }
    case 'ExpressionStatement': {
      const expressionStatement = node as ExpressionStatement
      return parseExpression(expressionStatement.expression)
    }
    case 'VariableDeclarationStatement': {
      const declaration = node as VariableDeclarationStatement

      const variables = declaration.variables.flatMap((v) =>
        getASTIdentifiers(v),
      )
      const initialValue = parseExpression(declaration.initialValue)

      return variables.concat(initialValue)
    }
    case 'ReturnStatement': {
      const returnStatement = node as ReturnStatement
      return parseExpression(returnStatement.expression)
    }
    case 'EmitStatement': {
      const emitStatement = node as EmitStatement
      return parseExpression(emitStatement.eventCall)
    }
    case 'ForStatement': {
      const forStatement = node as ForStatement
      const init = getASTIdentifiers(forStatement.initExpression)
      const condition = parseExpression(
        forStatement.conditionExpression ?? null,
      )
      const loopExpression = getASTIdentifiers(forStatement.loopExpression)
      const body = getASTIdentifiers(forStatement.body)
      return init.concat(condition).concat(loopExpression).concat(body)
    }
    case 'WhileStatement': {
      const whileStatement = node as WhileStatement
      const condition = parseExpression(whileStatement.condition)
      const body = getASTIdentifiers(whileStatement.body)
      return condition.concat(body)
    }
    case 'TryStatement': {
      const tryStatement = node as TryStatement
      const expression = parseExpression(tryStatement.expression)
      const returnParameters = (tryStatement.returnParameters ?? []).flatMap(
        (p) => getASTIdentifiers(p),
      )
      const body = getASTIdentifiers(tryStatement.body)
      const catchClauses = tryStatement.catchClauses.flatMap((c) =>
        getASTIdentifiers(c),
      )
      return expression
        .concat(returnParameters)
        .concat(body)
        .concat(catchClauses)
    }
    case 'CatchClause': {
      const catchClause = node as CatchClause
      const parameters = (catchClause.parameters ?? []).flatMap((p) =>
        getASTIdentifiers(p),
      )
      const body = getASTIdentifiers(catchClause.body)
      return parameters.concat(body)
    }
    case 'UncheckedStatement': {
      return getASTIdentifiers((node as UncheckedStatement).block)
    }
    case 'CustomErrorDefinition': {
      return (node as CustomErrorDefinition).parameters.flatMap((p) =>
        getASTIdentifiers(p),
      )
    }
    case 'EventDefinition': {
      return (node as EventDefinition).parameters.flatMap((p) =>
        getASTIdentifiers(p),
      )
    }
    case 'FunctionDefinition': {
      const defintion = node as FunctionDefinition
      const params = defintion.parameters.flatMap((p) =>
        getASTIdentifiers(p),
      )
      const returnParams = (defintion.returnParameters ?? []).flatMap((p) =>
        getASTIdentifiers(p),
      )
      const body = getASTIdentifiers(defintion.body)

      return params.concat(returnParams).concat(body)
    }
    case 'ModifierDefinition': {
      const mod = node as ModifierDefinition
      const params = mod.parameters ?? []

      const paramTypes = params.flatMap((p) => getASTIdentifiers(p))
      const librariesFromBlock = getASTIdentifiers(mod.body)

      return paramTypes.concat(librariesFromBlock)
    }
    case 'StateVariableDeclaration': {
      const decl = node as StateVariableDeclaration

      const varTypes = decl.variables.flatMap((v) => getASTIdentifiers(v))
      const expr = parseExpression(decl.initialValue)

      return expr.concat(varTypes)
    }
    case 'StructDefinition': {
      return (node as StructDefinition).members.flatMap((m) =>
        getASTIdentifiers(m),
      )
    }
    case 'TypeDefinition': {
      const typeDefinition = node as TypeDefinition
      return parseTypeName(typeDefinition.definition)
    }
    case 'UsingForDeclaration': {
      const declaration = node as UsingForDeclaration
      const typeName = parseTypeName(declaration.typeName)
      const libraryName = declaration.libraryName ?? []

      return typeName.concat(libraryName)
    }
    case 'InheritanceSpecifier': {
      const specifier = node as InheritanceSpecifier
      const baseName = parseTypeName(specifier.baseName)
      const args = specifier.arguments.flatMap((a) => parseExpression(a))

      return args.concat(baseName)
    }
    case 'ContractDefinition': {
      const defintion = node as ContractDefinition
      const name = defintion.name
      const baseContracts = defintion.baseContracts.flatMap((c) =>
        getASTIdentifiers(c),
      )
      const subNodes = defintion.subNodes.flatMap((n) =>
        getASTIdentifiers(n),
      )

      return [name].concat(baseContracts).concat(subNodes)
    }
    case 'NameValueList': {
      const valueList = node as NameValueList
      const identifiers = valueList.identifiers.flatMap((i) =>
        getASTIdentifiers(i),
      )
      const args = valueList.arguments.flatMap((a) => parseExpression(a))
      return identifiers.concat(args)
    }
    case 'PragmaDirective':
    case 'ImportDirective':
    case 'EnumDefinition': {
      return []
    }
    case 'BinaryOperation':
    case 'IndexAccess':
    case 'IndexRangeAccess':
    case 'TupleExpression':
    case 'Conditional':
    case 'MemberAccess':
    case 'FunctionCall':
    case 'UnaryOperation':
    case 'NewExpression':
    case 'BooleanLiteral':
    case 'NumberLiteral':
    case 'StringLiteral':
    case 'NameValueExpression': {
      return parseExpression(node as Expression)
    }
    case 'ElementaryTypeName':
    case 'UserDefinedTypeName':
    case 'Mapping':
    case 'ArrayTypeName':
    case 'FunctionTypeName': {
      return parseTypeName(node as TypeName)
    }
    default: {
      throw new Error(`TopLevelFunc: Unknown node type: [${node.type}]`)
    }
  }
}

function parseExpression(expr: Expression | null): string[] {
  if (!expr?.type) {
    return []
  }

  switch (expr.type) {
    case 'BinaryOperation': {
      return parseExpression(expr.left).concat(parseExpression(expr.right))
    }
    case 'FunctionCall': {
      return parseExpression(expr.expression)
        .concat(expr.arguments.flatMap((k) => parseExpression(k)))
        .concat(expr.identifiers.map((i) => i.name))
    }
    case 'IndexAccess': {
      return parseExpression(expr.base).concat(parseExpression(expr.index))
    }
    case 'TupleExpression': {
      return expr.components.flatMap((component) =>
        getASTIdentifiers(component),
      )
    }
    case 'MemberAccess': {
      return parseExpression(expr.expression)
    }
    case 'Conditional': {
      return parseExpression(expr.condition)
        .concat(parseExpression(expr.trueExpression))
        .concat(parseExpression(expr.falseExpression))
    }
    case 'Identifier': {
      return [expr.name]
    }
    case 'NewExpression': {
      return parseTypeName(expr.typeName)
    }
    case 'UnaryOperation': {
      return parseExpression(expr.subExpression)
    }
    case 'IndexRangeAccess': {
      const base = parseExpression(expr.base)
      const indexStart = parseExpression(expr.indexStart ?? null)
      const indexEnd = parseExpression(expr.indexEnd ?? null)

      return base.concat(indexStart).concat(indexEnd)
    }
    case 'ElementaryTypeName': {
      return parseTypeName(expr)
    }
    case 'NameValueExpression': {
      return parseExpression(expr.expression).concat(
        getASTIdentifiers(expr.arguments),
      )
    }
    case 'NumberLiteral':
    case 'BooleanLiteral':
    case 'HexLiteral':
    case 'StringLiteral': {
      return []
    }
    default: {
      throw new Error(
        `parseExpression: Unknown expression type: [${expr.type}]`,
      )
    }
  }
}

function parseTypeName(type: TypeName | null): string[] {
  if (!type?.type) {
    return []
  }

  switch (type.type) {
    case 'ElementaryTypeName': {
      return [type.name]
    }
    case 'UserDefinedTypeName': {
      return [type.namePath]
    }
    case 'Mapping': {
      return parseTypeName(type.keyType).concat(parseTypeName(type.valueType))
    }
    case 'ArrayTypeName': {
      return parseTypeName(type.baseTypeName)
    }
    case 'FunctionTypeName': {
      return []
    }
  }
}
