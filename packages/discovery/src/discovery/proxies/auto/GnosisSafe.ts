import { assert } from '@l2beat/backend-tools'
import { ProxyDetails } from '@l2beat/discovery-types'

import { EthereumAddress } from '../../../utils/EthereumAddress'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { bytes32ToAddress } from '../../utils/address'
import { getCallResult } from '../../utils/getCallResult'

async function getMasterCopy(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  blockNumber: number,
): Promise<EthereumAddress | undefined> {
  const [callResult, slot0] = await Promise.all([
    getCallResult<string>(
      provider,
      address,
      'function masterCopy() view returns(address)',
      [],
      blockNumber,
    ),
    provider.getStorage(address, 0, blockNumber),
  ])
  const slot0Address = bytes32ToAddress(slot0)
  if (callResult && slot0Address === EthereumAddress(callResult)) {
    return slot0Address
  }
}

async function getModules(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  blockNumber: number,
): Promise<EthereumAddress[]> {
  const SENTINEL_MODULES = '0x0000000000000000000000000000000000000001'
  const PAGINATION_SIZE = 10

  let next = SENTINEL_MODULES
  const modules: EthereumAddress[] = []
  do {
    const result = await getCallResult<[string[], string]>(
      provider,
      address,
      'function getModulesPaginated(address start, uint256 pageSize) view returns (address[] array, address next)',
      [next, PAGINATION_SIZE],
      blockNumber,
      2, // Result length 2, [modules[], next]
    )

    assert(result, 'Failed to get modules')

    result[0].forEach((module) => modules.push(EthereumAddress(module)))
    next = result[1]
  } while (next !== SENTINEL_MODULES)
  return modules
}

export async function detectGnosisSafe(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  blockNumber: number,
): Promise<ProxyDetails | undefined> {
  const masterCopy = await getMasterCopy(provider, address, blockNumber)
  if (!masterCopy) {
    return
  }
  const modules = await getModules(provider, address, blockNumber)

  return {
    implementations: [masterCopy],
    relatives: modules,
    upgradeability: {
      type: 'gnosis safe',
      masterCopy,
      modules,
    },
  }
}
