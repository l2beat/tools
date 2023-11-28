import * as solc from 'solc'
import { z } from 'zod'

import { ContractSource } from '../utils/EtherscanLikeClient'
import { getLayout } from './getLayout'
import { LayoutItem } from './LayoutItem'
import { parseContractSource, SolcInput } from './parseContractSource'
import { SolidityStorageLayout } from './SolidityStorageLayout'

export function parseAndGetLayout(source: ContractSource): LayoutItem[] {
  const input = parseContractSource(source.SourceCode)
  if (!input.settings) {
    input.settings = {}
  }
  input.settings.outputSelection = { '*': { '*': ['storageLayout'] } }

  const out = compile(input)
  const mainContract = Object.values(out.contracts).find(
    (c) => c[source.ContractName],
  )?.[source.ContractName]
  if (!mainContract) {
    throw new Error(`Cannot find main contract: ${source.ContractName}`)
  }
  return getLayout(mainContract.storageLayout)
}

function compile(input: SolcInput): SpecificSolcOutput {
  return SpecificSolcOutput.parse(
    JSON.parse(solc.compile(JSON.stringify(input))),
  )
}

type SpecificSolcOutput = z.infer<typeof SpecificSolcOutput>
const SpecificSolcOutput = z.object({
  contracts: z.record(
    z.record(z.object({ storageLayout: SolidityStorageLayout })),
  ),
})
