import { compile } from 'solc'

import { ContractSource } from '../utils/EtherscanLikeClient'
import { getLayout } from './getLayout'
import { LayoutItem } from './LayoutItem'
import { SolidityStorageLayout } from './SolidityStorageLayout'

export function parseAndGetLayout(source: ContractSource): LayoutItem[] {
  const mainContract = source.ContractName
  /* eslint-disable */
  const map = parseContractSource(source.SourceCode)
  map.settings.outputSelection = { '*': { '*': ['storageLayout'] } }
  const out = JSON.parse(compile(JSON.stringify(map)))
  for (const contracts of Object.values(out.contracts) as any) {
    // TODO: better selection of main contract
    const contract = contracts[mainContract]
    if (contract) {
      const output = SolidityStorageLayout.parse(contract.storageLayout)
      return getLayout(output)
    }
  }
  /* eslint-enable */
  throw new Error(`Cannot find main contract: ${mainContract}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParsedSourceCode = any
function parseContractSource(source: string): ParsedSourceCode {
  if (source.startsWith('{{') && source.endsWith('}}')) {
    return JSON.parse(source.slice(1, -1))
  }
  return JSON.parse(source)
}
