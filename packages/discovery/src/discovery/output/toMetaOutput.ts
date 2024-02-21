import { assert } from '@l2beat/backend-tools'
import { ContractValue } from '@l2beat/discovery-types'

import { Analysis } from '../analysis/AddressAnalyzer'
import {
  ContractMeta,
  DiscoveryMeta,
  ReviewMeta,
} from '../config/DiscoveryMeta'

export function toMetaOutput(
  results: Analysis[],
  oldMeta: DiscoveryMeta | undefined,
): DiscoveryMeta {
  const contracts = results.filter((r) => r.type === 'Contract')

  return {
    ['$schema']: getSchemaPath(oldMeta),
    metas: contracts.map((c) =>
      toContractMeta(c, getOldContractMeta(c, oldMeta)),
    ),
  }
}

function toContractMeta(
  contract: Analysis,
  oldContractMeta: ContractMeta,
): ContractMeta {
  assert(
    contract.type === 'Contract',
    `Expected a contract, got an ${contract.type}`,
  )

  return {
    name: contract.name,
    values: toReviewMeta(contract.values, oldContractMeta),
  }
}

function toReviewMeta(
  value: Record<string, ContractValue>,
  oldContractMeta: ContractMeta,
): Record<string, ReviewMeta> {
  const keys = Object.keys(value)

  const DEFAULT_REVIEW = {
    description: 'UNKNOWN',
    severity: 'UNKNOWN',
    type: 'UNKNOWN',
  }

  return Object.fromEntries(
    keys.map((key) => [key, oldContractMeta.values[key] ?? DEFAULT_REVIEW]),
  )
}

function getSchemaPath(oldMeta: DiscoveryMeta | undefined): string {
  return oldMeta?.$schema ?? '../../meta.schema.json'
}

function getOldContractMeta(
  contract: Analysis,
  oldMeta: DiscoveryMeta | undefined,
): ContractMeta {
  assert(
    contract.type === 'Contract',
    `Expected a contract, got an ${contract.type}`,
  )

  const DEFAULT_CONTRACT_META = { name: contract.name, values: {} }
  if (!oldMeta) {
    return DEFAULT_CONTRACT_META
  }

  const oldContract = oldMeta.metas.find((m) => m.name === contract.name)
  return oldContract ?? DEFAULT_CONTRACT_META
}
