import { UpgradeabilityParameters } from '@l2beat/discovery-types'
import { expect } from 'earl'

import { EthereumAddress } from '../../utils/EthereumAddress'
import { UnixTime } from '../../utils/UnixTime'
import { AnalyzedContract } from '../analysis/AddressAnalyzer'
import { toMetaOutput } from './toMetaOutput'

const base = {
  type: 'Contract' as const,
  derivedName: undefined,
  errors: {},
  values: {},
  isVerified: true,
  deploymentTimestamp: new UnixTime(1234),
  deploymentBlockNumber: 9876,
  upgradeability: { type: 'immutable' } as UpgradeabilityParameters,
  implementations: [],
  abis: {},
  source: [],
}

const ADDRESS_A = EthereumAddress('0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa')
const ADDRESS_B = EthereumAddress('0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB')

const CONTRACT_A: AnalyzedContract = {
  ...base,
  address: ADDRESS_A,
  name: 'A',
  isVerified: false,
}

const CONTRACT_B: AnalyzedContract = {
  ...base,
  address: ADDRESS_B,
  name: 'B',
  values: {
    foo: 'foo',
    bar: 'bar',
  },
}

describe(toMetaOutput.name, () => {
  it('returns a meta for a single contract with values and using old meta', () => {
    const result = toMetaOutput([CONTRACT_B], {
      metas: [
        {
          name: 'B',
          values: {
            foo: {
              description: 'foo',
              severity: 'foo',
              type: 'foo',
            },
            baz: {
              description: 'baz',
              severity: 'baz',
              type: 'baz',
            },
          },
        },
      ],
    })

    expect(result).toEqual({
      $schema: '../../meta.schema.json',
      metas: [
        {
          name: 'B',
          values: {
            foo: {
              description: 'foo',
              severity: 'foo',
              type: 'foo',
            },
            bar: {
              description: 'UNKNOWN',
              severity: 'UNKNOWN',
              type: 'UNKNOWN',
            },
          },
        },
      ],
    })
  })

  it('returns a meta for a single contract with values', () => {
    const result = toMetaOutput([CONTRACT_B], undefined)
    expect(result).toEqual({
      $schema: '../../meta.schema.json',
      metas: [
        {
          name: 'B',
          values: {
            foo: {
              description: 'UNKNOWN',
              severity: 'UNKNOWN',
              type: 'UNKNOWN',
            },
            bar: {
              description: 'UNKNOWN',
              severity: 'UNKNOWN',
              type: 'UNKNOWN',
            },
          },
        },
      ],
    })
  })

  it('returns a meta for a single contract without values', () => {
    const result = toMetaOutput([CONTRACT_A], undefined)
    expect(result).toEqual({
      $schema: '../../meta.schema.json',
      metas: [
        {
          name: 'A',
          values: {},
        },
      ],
    })
  })

  it('returns an empty meta for empty analysis', () => {
    const result = toMetaOutput([], undefined)
    expect(result).toEqual({
      $schema: '../../meta.schema.json',
      metas: [],
    })
  })
})
