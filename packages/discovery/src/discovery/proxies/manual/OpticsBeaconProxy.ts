import { assert } from '@l2beat/backend-tools'
import { ProxyDetails } from '@l2beat/discovery-types'
import { ethers } from 'ethers'

import { Bytes } from '../../../utils/Bytes'
import { EthereumAddress } from '../../../utils/EthereumAddress'
import {
  decodeConstructorArgs,
  serializeResult,
} from '../../handlers/user/ConstructorArgsHandler'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { bytes32ToAddress } from '../../utils/address'

export async function getOpticsBeaconProxy(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  blockNumber: number,
): Promise<ProxyDetails | undefined> {
  const proxyConstructorFragment = ethers.utils.Fragment.from(
    'constructor(address _upgradeBeacon, bytes memory _initializationCalldata)',
  )
  const upgradeBeacon = await getAddressFromConstructor(
    provider,
    address,
    proxyConstructorFragment,
    '_upgradeBeacon',
  )

  // const beaconConstructorFragment = ethers.utils.Fragment.from(
  //   'constructor(address _initialImplementation, address _controller)',
  // )
  // const beaconController = await getAddressFromConstructor(
  //   provider,
  //   address,
  //   beaconConstructorFragment,
  //   '_controller',
  // )

  const beaconController = EthereumAddress.ZERO

  const implementationCallResult = await provider.call(
    upgradeBeacon,
    Bytes.fromHex('0x'),
    blockNumber,
  )

  const implementation = bytes32ToAddress(implementationCallResult)

  return {
    upgradeability: {
      type: 'Optics Beacon proxy',
      upgradeBeacon,
      beaconController,
      implementation,
    },
    implementations: [implementation],
    relatives: [upgradeBeacon],
  }
}
async function getAddressFromConstructor(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  constructorFragment: ethers.utils.Fragment,
  path: string,
): Promise<EthereumAddress> {
  const txHash = await provider.getContractDeploymentTx(address)
  const tx = await provider.getTransaction(txHash)
  const result = decodeConstructorArgs(constructorFragment, tx.data)
  assert(typeof result === 'object', 'Could not decode constructor')
  const args = Object.fromEntries(
    Object.entries(result).map(([key, value]) => [
      key,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      serializeResult(value),
    ]),
  )

  const arg = args[path]
  assert(arg !== undefined, 'Argument not found: ' + path)
  assert(typeof arg === 'string', 'Argument is not a string: ' + path)

  return EthereumAddress(arg)
}
