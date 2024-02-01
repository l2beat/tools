import { assert, Logger } from '@l2beat/backend-tools'
import { parse } from '@solidity-parser/parser'
import { readdir, readFile } from 'fs/promises'
import { basename, resolve } from 'path'

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
): Promise<void> {
  logger.info(`Path: ${path}`)
  logger.info(`Root contract name: ${rootContractName}`)

  let elapsedMilliseconds = -Date.now()
  const files = await Promise.all(
    filterOutNonSolidityFiles(await listFilesRecursively(path)).map((f) =>
      parseFile(f),
    ),
  )
  elapsedMilliseconds += Date.now()
  const sourceLineCount = files.reduce(
    (acc, f) => acc + f.source.split('\n').length,
    0,
  )
  const linesPerSecond = sourceLineCount / (elapsedMilliseconds / 1000)
  logger.info(
    `Parsed ${
      files.length
    } files in ${elapsedMilliseconds}ms (${linesPerSecond.toFixed(
      0,
    )} lines/s))`,
  )

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
  // We are not using array, instead we are using concat to flatten the array
  return files.flat()
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
