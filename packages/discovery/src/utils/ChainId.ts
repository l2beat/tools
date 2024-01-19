export interface ChainId extends Number {
  _ChainIdBrand: number
}

export function ChainId(value: number): ChainId {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError('Invalid ChainId')
  }
  return value as unknown as ChainId
}

ChainId.fromName = function (name: string): ChainId {
  const entry = Object.entries(CHAIN_IDS).find(([_, v]) => v === name)
  if (!entry) {
    throw new TypeError('Invalid chain name: ' + name)
  }
  return ChainId(+entry[0])
}

ChainId.getName = function (chainId: ChainId): string {
  const chain = Object.entries(CHAIN_IDS).find(
    ([k]) => k === chainId.toString(),
  )
  if (!chain) {
    throw new TypeError(
      'Programmer error: Invalid chainId: ' + chainId.toString(),
    )
  }
  return chain[1]
}

type ChainIds = typeof CHAIN_IDS

/**
 * Only to use when defining ChainId.ETHEREUM etc. constants.
 * Will save you from typos, but is annoying to work with strings.
 */
function chainIdFromName(name: ChainIds[keyof ChainIds]): ChainId {
  const entry = Object.entries(CHAIN_IDS).find(([_, v]) => v === name)
  if (!entry) {
    throw new TypeError('Programmer error: Invalid chain name: ' + name)
  }
  return ChainId(+entry[0])
}

const CHAIN_IDS = {
  1: 'ethereum',
  42161: 'arbitrum',
  10: 'optimism',
  137: 'polygonpos',
  56: 'bsc',
  43114: 'avalanche',
  42220: 'celo',
  59144: 'linea',
  8453: 'base',
  1101: 'polygonzkevm',
  100: 'gnosis',
  957: 'lyra',
  169: 'mantapacific',
  '-1': 'native',
} as const

ChainId.ETHEREUM = chainIdFromName('ethereum')
ChainId.ARBITRUM = chainIdFromName('arbitrum')
ChainId.OPTIMISM = chainIdFromName('optimism')
ChainId.POLYGONPOS = chainIdFromName('polygonpos')
ChainId.BSC = chainIdFromName('bsc')
ChainId.AVALANCHE = chainIdFromName('avalanche')
ChainId.CELO = chainIdFromName('celo')
ChainId.LINEA = chainIdFromName('linea')
ChainId.BASE = chainIdFromName('base')
ChainId.POLYGONZKEVM = chainIdFromName('polygonzkevm')
ChainId.GNOSIS = chainIdFromName('gnosis')
ChainId.NMV = chainIdFromName('native')
