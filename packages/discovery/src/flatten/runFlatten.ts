import { assert, Logger } from '@l2beat/backend-tools'
import { parse } from '@solidity-parser/parser'
import { readdir, readFile, writeFile } from 'fs/promises'
import { basename, resolve } from 'path'

type ParseResult = ReturnType<typeof parse>

export interface ParsedFile {
  path: string
  source: string
  ast: ParseResult
}

interface ContractDecl {
  inheritsFrom: string[]
  name: string
  source: string
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

  console.time('flattening')
  const flattened = flattenStartingFrom(contracts, rootContractName)
  console.timeEnd('flattening')

  await writeFile('flattened.sol', flattened)
}

async function listFilesRecursively(path: string): Promise<string[]> {
  const dirents = await readdir(path, { withFileTypes: true })
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = resolve(path, dirent.name)
      return dirent.isDirectory() ? listFilesRecursively(res) : res
    }),
  )

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
          inheritsFrom: c.baseContracts.map((bc) => bc.baseName.namePath),
          source: file.source.slice(c.range[0], c.range[1] + 1),
        }
      }),
    )
  }

  return result
}

function flattenStartingFrom(
  contracts: ContractDecl[],
  rootContractName: string,
): string {
  let result = ''

  const rootContract = contracts.filter((c) => c.name === rootContractName)
  assert(
    rootContract.length === 1 && rootContract[0] !== undefined,
    'Root contract not found or ambiguous',
  )

  result = pushSource(result, rootContract[0].source)

  // Depth first search
  const stack = rootContract[0].inheritsFrom.slice().reverse()
  while (stack.length > 0) {
    const currentContractName = stack.pop()
    assert(currentContractName !== undefined, 'Stack should not be empty')

    const currentContract = contracts.filter(
      (c) => c.name === currentContractName,
    )
    assert(
      currentContract.length === 1 && currentContract[0] !== undefined,
      'Contract not found or ambiguous',
    )

    result = pushSource(result, currentContract[0].source)
    stack.push(...currentContract[0].inheritsFrom)
  }

  return result
}

function pushSource(acc: string, sourceCode: string): string {
  return acc + sourceCode + '\n\n'
}
