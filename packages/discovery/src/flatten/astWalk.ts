import { assert } from '@l2beat/backend-tools'
// TODO(radomski): The parser does not expose the AST types for SOME reason.
// Either we ignore this error or we fork the parser and expose the types.
// eslint-disable-next-line import/no-unresolved
import {
  BaseASTNode,
  Block,
  CustomErrorDefinition,
  EmitStatement,
  EventDefinition,
  Expression,
  ExpressionStatement,
  Identifier,
  IfStatement,
  ModifierDefinition,
  ReturnStatement,
  RevertStatement,
  StateVariableDeclaration,
  StructDefinition,
  TypeDefinition,
  TypeName,
  UsingForDeclaration,
  VariableDeclaration,
  VariableDeclarationStatement,
} from '@solidity-parser/parser/dist/src/ast-types'

export function getUniqueIdentifiers(node: BaseASTNode | null): string[] {
  if (node === null) {
    return []
  }

  assert(node.range !== undefined)

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
        getUniqueIdentifiers(statement),
      )
    }
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
      const trueBody = getUniqueIdentifiers(ifStatement.trueBody)
      const falseBody = getUniqueIdentifiers(ifStatement.falseBody)

      return condition.concat(trueBody).concat(falseBody)
    }
    case 'ExpressionStatement': {
      const expressionStatement = node as ExpressionStatement
      return parseExpression(expressionStatement.expression)
    }
    case 'CustomErrorDefinition': {
      return (node as CustomErrorDefinition).parameters.flatMap((p) =>
        getUniqueIdentifiers(p),
      )
    }
    case 'EventDefinition': {
      return (node as EventDefinition).parameters.flatMap((p) =>
        getUniqueIdentifiers(p),
      )
    }
    case 'FunctionDefinition': {
      return (node as EventDefinition).parameters.flatMap((p) =>
        getUniqueIdentifiers(p),
      )
    }
    case 'ModifierDefinition': {
      const mod = node as ModifierDefinition
      const params = mod.parameters ?? []

      const paramTypes = params.flatMap((p) => getUniqueIdentifiers(p))
      const librariesFromBlock = getUniqueIdentifiers(mod.body)

      return paramTypes.concat(librariesFromBlock)
    }
    case 'VariableDeclarationStatement': {
      const declaration = node as VariableDeclarationStatement

      const variables = declaration.variables.flatMap((v) =>
        getUniqueIdentifiers(v),
      )
      const initialValue = parseExpression(declaration.initialValue)

      return variables.concat(initialValue)
    }
    case 'StateVariableDeclaration': {
      const decl = node as StateVariableDeclaration

      const varTypes = decl.variables.flatMap((v) => getUniqueIdentifiers(v))
      const expr = parseExpression(decl.initialValue)

      return expr.concat(varTypes)
    }
    case 'StructDefinition': {
      return (node as StructDefinition).members.flatMap((m) =>
        getUniqueIdentifiers(m),
      )
    }
    case 'ReturnStatement': {
      const returnStatement = node as ReturnStatement
      return parseExpression(returnStatement.expression)
    }
    case 'EmitStatement': {
      const emitStatement = node as EmitStatement
      return parseExpression(emitStatement.eventCall)
    }
    case 'BinaryOperation': {
      return parseExpression(node as Expression)
    }
    case 'EnumDefinition': {
      return []
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
  if (!expr || !expr.type) {
    return []
  }
  assert(expr.range !== undefined)

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
        getUniqueIdentifiers(component),
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
        `parseExpression: Unknown expression type: [${expr.type}]`,
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
