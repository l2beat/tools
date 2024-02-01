import { Logger, assert } from '@l2beat/backend-tools'
import { readFile, readdir } from 'fs/promises'
import { basename, resolve } from 'path'
import { parse } from '@solidity-parser/parser'
import {
  ASTNode,
  BaseASTNode,
} from '@solidity-parser/parser/dist/src/ast-types'

type ParseResult = ReturnType<typeof parse>

export interface ParsedFile {
  path: string
  source: string
  ast: ParseResult
}

interface ByteRange {
  start: number
  end: number
}

interface ContractDecl {
  name: string
  byteRange: ByteRange
}

export async function runFlatten(
  path: string,
  rootContractName: string,
  logger: Logger,
) {
  logger.info(`Path: ${path}`)
  logger.info(`Root contract name: ${rootContractName}`)

  console.time('parsing')
  const files = await Promise.all(
    filterOutNonSolidityFiles(await listFilesRecursively(path)).map((f) =>
      parseFile(f),
    ),
  )
  console.timeEnd('parsing')

  console.time('isolation')
  const contracts = isolateContracts(files)
  console.timeEnd('isolation')
  console.log(contracts)
}

async function listFilesRecursively(path: string): Promise<string[]> {
  const dirents = await readdir(path, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = resolve(path, dirent.name)
      return dirent.isDirectory() ? listFilesRecursively(res) : res
    }),
  )
  return Array.prototype.concat(...files)
}

function filterOutNonSolidityFiles(files: string[]): string[] {
  return files.filter((f) => basename(f).endsWith('.sol'))
}

async function parseFile(path: string): Promise<ParsedFile> {
  const source = await readFile(path, 'utf-8')
  return {
    path,
    source,
    ast: parse(source, { range: true }),
  }
}

function isolateContracts(files: ParsedFile[]): ContractDecl[] {
  const result = []

  for (const file of files) {
    assert(file.ast.type === 'SourceUnit')
    const contractDeclarations = file.ast.children.filter(
      (n) => n.type === 'ContractDefinition',
    )
    result.push(
      ...contractDeclarations.map((c) => {
        assert(c.type === 'ContractDefinition' && c.range !== undefined)

        return {
          name: c.name,
          byteRange: {
            start: c.range[0],
            end: c.range[1],
          },
        }
      }),
    )
  }

  return result
}

//function buildInheritanceTree(files: ParsedFile[], rootContractName: string): void {
//   return files.filter((f) => f.ast.type === 'SourceUnit')
// }
