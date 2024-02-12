import { assert } from '@l2beat/backend-tools'
import {
  ContractDefinition,
  UsingForDeclaration,
  BaseASTNode,
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
} from '@solidity-parser/parser/dist/src/ast-types'

export function getUniqueIdentifiers(
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
        getUniqueIdentifiers(statement, path, content),
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
      const trueBody = getUniqueIdentifiers(ifStatement.trueBody, path, content)
      const falseBody = getUniqueIdentifiers(ifStatement.falseBody, path, content)

      return condition.concat(trueBody).concat(falseBody)
    }
    case 'ExpressionStatement': {
      const expressionStatement = node as ExpressionStatement
      return parseExpression(expressionStatement.expression, path, content)
    }
    case 'CustomErrorDefinition': {
      return (node as CustomErrorDefinition).parameters.flatMap((p) =>
        getUniqueIdentifiers(p, path, content),
      )
    }
    case 'EventDefinition': {
      return (node as EventDefinition).parameters.flatMap((p) =>
        getUniqueIdentifiers(p, path, content),
      )
    }
    case 'FunctionDefinition': {
      return (node as EventDefinition).parameters.flatMap((p) =>
        getUniqueIdentifiers(p, path, content),
      )
    }
    case 'ModifierDefinition': {
      const mod = node as ModifierDefinition
      const params = mod.parameters ?? []

      const paramTypes = params.flatMap((p) =>
        getUniqueIdentifiers(p, path, content),
      )
      const librariesFromBlock = getUniqueIdentifiers(mod.body, path, content)

      return paramTypes.concat(librariesFromBlock)
    }
    case 'VariableDeclarationStatement': {
      const declaration = node as VariableDeclarationStatement

      const variables = declaration.variables.flatMap((v) =>
        getUniqueIdentifiers(v, path, content),
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
        getUniqueIdentifiers(v, path, content),
      )
      const expr = parseExpression(decl.initialValue, path, content)

      return expr.concat(varTypes)
    }
    case 'StructDefinition': {
      return (node as StructDefinition).members.flatMap((m) =>
        getUniqueIdentifiers(m, path, content),
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
        getUniqueIdentifiers(component, path, content),
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
