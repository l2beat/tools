import { assert, Logger } from '@l2beat/backend-tools'
import { parse } from '@solidity-parser/parser'
import { readdir, readFile, writeFile } from 'fs/promises'
import { basename, normalize, resolve } from 'path'

type ParseResult = ReturnType<typeof parse>

export interface ParsedFile {
  path: string
  source: string
  ast: ParseResult

  declaredContracts: ContractDecl[]
  importedContracts: {
    path: string
    originalName: string
    importedName: string
  }[]
}

interface ByteRange {
  start: number
  end: number
}

interface ContractDecl {
  inheritsFrom: string[]
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
  isolateContracts(files)
  console.timeEnd('isolation')

  console.time('flattening')
  const flattened = flattenStartingFrom(files, rootContractName)
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
    declaredContracts: [],
    importedContracts: [],
  }
}

function isolateContracts(files: ParsedFile[]): void {
  for (const file of files) {
    const contractDeclarations = file.ast.children.filter(
      (n) => n.type === 'ContractDefinition',
    )

    file.declaredContracts = contractDeclarations.map((c) => {
      assert(c.type === 'ContractDefinition' && c.range !== undefined)

      return {
        name: c.name,
        inheritsFrom: c.baseContracts.map((bc) => bc.baseName.namePath),
        byteRange: {
          start: c.range[0],
          end: c.range[1],
        },
      }
    })
  }

  for (const file of files) {
    const importDirectives = file.ast.children.filter(
      (n) => n.type === 'ImportDirective',
    )

    file.importedContracts = importDirectives.flatMap((i) => {
      assert(i.type === 'ImportDirective' && i.range !== undefined)

      // We want to import everything from the file
      if (i.symbolAliases === null) {
        // TODO(radomski): This is the biggest unknown and I should really
        // consider if this simple string comparison will solve every single
        // possible case.
        const matchingFiles = files.filter(
          (f) => pathsMatch(f.path, i.path)
        )

        assert(
          matchingFiles.length === 1 && matchingFiles[0] !== undefined,
          'File not found or ambiguous',
        )

        return matchingFiles[0].declaredContracts.map((c) => ({
          path: i.path,
          originalName: c.name,
          importedName: c.name,
        }))
      }

      return i.symbolAliases.map((a) => ({
        path: i.path,
        originalName: a[0],
        importedName: a[1] ?? a[0],
      }))
    })
  }
}

function flattenStartingFrom(
  files: ParsedFile[],
  rootContractName: string,
): string {
  let result = ''

  const fileWithRootContracts = files.filter((f) =>
    f.declaredContracts.some((c) => c.name === rootContractName),
  )
  assert(
    fileWithRootContracts.length === 1 &&
      fileWithRootContracts[0] !== undefined,
    'File with root contract not found or ambiguous',
  )
  const fileWithRootContract = fileWithRootContracts[0]

  const rootContract = fileWithRootContract.declaredContracts.filter(
    (c) => c.name === rootContractName,
  )
  assert(
    rootContract.length === 1 && rootContract[0] !== undefined,
    'Root contract not found or ambiguous',
  )

  result = pushSource(
    result,
    fileWithRootContract.source,
    rootContract[0].byteRange,
  )

  // Depth first search
  const stack = rootContract[0].inheritsFrom
    .slice()
    .reverse()
    .map((contractName) => ({
      contractName,
      path: fileWithRootContract.path,
    }))

  while (stack.length > 0) {
    const currentEntry = stack.pop()
    assert(currentEntry !== undefined, 'Stack should not be empty')

    const currentFiles = files.filter((f) => f.path.endsWith(currentEntry.path))
    assert(
      currentFiles.length === 1 && currentFiles[0] !== undefined,
      'File not found or ambiguous',
    )
    const currentFile = currentFiles[0]

    const isDeclared = currentFile.declaredContracts.some(
      (c) => c.name === currentEntry.contractName,
    )
    const isImported = currentFile.importedContracts.some(
      (c) => c.importedName === currentEntry.contractName,
    )

    assert(isDeclared || isImported, 'Contract not found')
    assert(!(isDeclared && isImported), 'Contract found in multiple files')

    if (isDeclared) {
      const currentContracts = currentFile.declaredContracts.filter(
        (c) => c.name === currentEntry.contractName,
      )
      assert(
        currentContracts.length === 1 && currentContracts[0] !== undefined,
        'Contract not found or ambiguous',
      )
      const currentContract = currentContracts[0]

      result = pushSource(result, currentFile.source, currentContract.byteRange)
      stack.push(
        ...currentContract.inheritsFrom.map((contractName) => ({
          contractName,
          path: currentFile.path,
        })),
      )
    } else {
      const currentImports = currentFile.importedContracts.filter(
        (c) => c.importedName === currentEntry.contractName,
      )
      assert(
        currentImports.length === 1 && currentImports[0] !== undefined,
        'Contract not found or ambiguous',
      )
      const currentImport = currentImports[0]

      const importedFiles = files.filter((f) =>
        pathsMatch(f.path, currentImport.path),
      )
      assert(
        importedFiles.length === 1 && importedFiles[0] !== undefined,
        'File not found or ambiguous',
      )
      const importedFile = importedFiles[0]

      const importedContracts = importedFile.declaredContracts.filter(
        (c) => c.name === currentImport.originalName,
      )
      assert(
        importedContracts.length === 1 && importedContracts[0] !== undefined,
        'Contract not found or ambiguous',
      )
      const importedContract = importedContracts[0]

      result = pushSource(
        result,
        importedFile.source,
        importedContract.byteRange,
      )
      stack.push(
        ...importedContract.inheritsFrom.map((contractName) => ({
          contractName,
          path: importedFile.path,
        })),
      )
    }
  }

  return result
}

function pushSource(acc: string, source: string, byteRange: ByteRange): string {
  return acc + source.slice(byteRange.start, byteRange.end + 1) + '\n\n'
}

function replaceAll(str: string, search: string, replacement: string): string {
  return str.split(search).join(replacement)
}

function pathsMatch(path1: string, path2: string): boolean {
  return (
    path1.endsWith(replaceAll(normalize(path2), '../', '')) &&
    basename(path1) === basename(path2)
  )
}
