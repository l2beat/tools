import { ProxyDetails } from '@l2beat/discovery-types'

import { Bytes } from '../../../utils/Bytes'
import { EthereumAddress } from '../../../utils/EthereumAddress'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { bytes32ToAddress } from '../../utils/address'
import { getAdmin  } from './Eip1967Proxy'

// keccak256('eip1967.proxy.implementation') - 1
const IMPLEMENTATION_SLOT = Bytes.fromHex(
  '0x11141f466c69fd409e1990e063b49cd6d61ed2ecff27a2e402e259ca6b9a01a3',
)

async function getImplementation(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  blockNumber: number,
): Promise<EthereumAddress> {
  return bytes32ToAddress(
    await provider.getStorage(
      address,
      IMPLEMENTATION_SLOT,
      blockNumber,
    ),
  )
}

export async function detectAxelarProxy(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  blockNumber: number,
): Promise<ProxyDetails | undefined> {
  const implementation = await getImplementation(
    provider,
    address,
    blockNumber,
  )
  if (implementation === EthereumAddress.ZERO) {
    return
  }

  // const [adminImplementation, admin] = await Promise.all([
  //   getImplementation(provider, address, blockNumber),
  //   getAdmin(provider, address, blockNumber),
  // ])
  //
  return {
    implementations: [implementation],
    relatives: [],
    upgradeability: {
      type: 'Axelar proxy',
      admin: implementation,
      implementation,
    },
  }
}
