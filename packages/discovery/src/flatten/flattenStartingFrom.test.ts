import { expect, mockFn, mockObject } from 'earl'

import { flattenStartingFrom } from './flattenStartingFrom'
import {
  ContractDeclaration,
  ContractFilePair,
  ParsedFile,
  ParsedFilesManager,
} from './ParsedFilesManager'

describe(flattenStartingFrom.name, () => {
  const DUMMY_AST_NODE = {}
  const LIBRARY_SOURCE = 'library Contract2 { function lf() public {} }'
  const BASE_SOURCE = 'contract Contract3 { function bcf() public {} }'
  const ROOT_SOURCE =
    'contract Contract1 is Contract3 { function cf() public { Contract2.lf(); this.bcf(); } }'
  const ROOT_FILE_SOURCE = `${LIBRARY_SOURCE}${BASE_SOURCE}${ROOT_SOURCE}`

  const LIBRARY_CONTRACT: ContractDeclaration = {
    name: 'Contract2',
    type: 'library',
    ast: DUMMY_AST_NODE as any,
    byteRange: {
      start: 0,
      end: LIBRARY_SOURCE.length - 1,
    },
    inheritsFrom: [],
    referencedContracts: [],
  }

  const BASE_CONTRACT: ContractDeclaration = {
    name: 'Contract3',
    type: 'contract',
    ast: DUMMY_AST_NODE as any,
    byteRange: {
      start: LIBRARY_SOURCE.length,
      end: LIBRARY_SOURCE.length + BASE_SOURCE.length - 1,
    },
    inheritsFrom: [],
    referencedContracts: [LIBRARY_CONTRACT.name],
  }

  const ROOT_CONTRACT: ContractDeclaration = {
    name: 'Contract1',
    type: 'contract',
    ast: DUMMY_AST_NODE as any,
    byteRange: {
      start: LIBRARY_SOURCE.length + BASE_SOURCE.length,
      end: LIBRARY_SOURCE.length + BASE_SOURCE.length + ROOT_SOURCE.length - 1,
    },
    inheritsFrom: [BASE_CONTRACT.name],
    referencedContracts: [LIBRARY_CONTRACT.name],
  }

  const ROOT_PARSED_FILE: Omit<ParsedFile, 'ast'> = {
    path: 'path',
    content: ROOT_FILE_SOURCE,
    contractDeclarations: [ROOT_CONTRACT, LIBRARY_CONTRACT],
    importDirectives: [],
  }

  it('flattens the source code', () => {
    const rootContractName = 'Contract1'
    const parsedFileManager = mockObject<ParsedFilesManager>({
      findContractDeclaration: mockFn((contractName): ContractFilePair => {
        expect(contractName).toEqual(rootContractName)

        return {
          contract: ROOT_CONTRACT,
          file: ROOT_PARSED_FILE,
        } as ContractFilePair
      }),
      tryFindContract: mockFn(
        (contractName, file): ContractFilePair | undefined => {
          expect(file).toEqual(ROOT_PARSED_FILE)

          if (contractName === LIBRARY_CONTRACT.name) {
            return {
              contract: LIBRARY_CONTRACT,
              file: ROOT_PARSED_FILE,
            } as ContractFilePair
          } else if (contractName === BASE_CONTRACT.name) {
            return {
              contract: BASE_CONTRACT,
              file: ROOT_PARSED_FILE,
            } as ContractFilePair
          }
        },
      ),
    })

    const result = flattenStartingFrom(rootContractName, parsedFileManager)

    expect(result).toEqual(
      `${LIBRARY_SOURCE}\n\n${BASE_SOURCE}\n\n${ROOT_SOURCE}\n\n`,
    )
  })

  it('throws if fails to find a contract', () => {
    const rootContractName = 'Contract1'
    const parsedFileManager = mockObject<ParsedFilesManager>({
      findContractDeclaration: mockFn((contractName): ContractFilePair => {
        expect(contractName).toEqual(rootContractName)

        return {
          contract: ROOT_CONTRACT,
          file: ROOT_PARSED_FILE,
        } as ContractFilePair
      }),
      tryFindContract: mockFn((): ContractFilePair | undefined => {
        return undefined
      }),
    })

    expect(() =>
      flattenStartingFrom(rootContractName, parsedFileManager),
    ).toThrow('Failed to find contract Contract3')
  })
})
