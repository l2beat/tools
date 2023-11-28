import { compile } from 'solc'

import { ContractSource } from '../utils/EtherscanLikeClient'
import { getLayout } from './getLayout'
import { SolidityStorageLayout } from './SolidityStorageLayout'

export function getCombinedLayout(sources: ContractSource[]): string {
  for (const source of sources) {
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
        console.log(JSON.stringify(getLayout(output), null, 2))
      }
    }
  }
  /* eslint-enable */
  return ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParsedSourceCode = any
function parseContractSource(source: string): ParsedSourceCode {
  if (source.startsWith('{{') && source.endsWith('}}')) {
    return JSON.parse(source.slice(1, -1))
  }
  return JSON.parse(source)
}
