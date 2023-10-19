import { ProxyDetails } from '@l2beat/discovery-types'
import { BigNumber, BytesLike, utils } from 'ethers'

import { Bytes } from '../../../utils/Bytes'
import { EthereumAddress } from '../../../utils/EthereumAddress'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { bytes32ToAddress } from '../../utils/address'

// keccak256(abi.encode(uint256(keccak256('eip1967.proxy.implementation')) - 1, s))
//
// where `s` is the slot of the `_addressStorage`, so in this case it's s = 2
const IMPLEMENTATION_SLOT = Bytes.fromHex(
  '0x11141f466c69fd409e1990e063b49cd6d61ed2ecff27a2e402e259ca6b9a01a3',
)

async function getImplementation(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  blockNumber: number,
): Promise<EthereumAddress> {
  return bytes32ToAddress(
    await provider.getStorage(address, IMPLEMENTATION_SLOT, blockNumber),
  )
}

export async function detectAxelarProxy(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  blockNumber: number,
): Promise<ProxyDetails | undefined> {
  const implementation = await getImplementation(provider, address, blockNumber)
  if (implementation === EthereumAddress.ZERO) {
    return
  }

  const adminDeployment = await getAdminsDeployment(provider, address)

  return {
    implementations: [implementation],
    relatives: [],
    upgradeability: {
      type: 'Axelar proxy',
      admins: adminDeployment.adminAddresses,
      adminThreshold: adminDeployment.adminThreshold,
      implementation,
    },
  }
}

async function getAdminsDeployment(
  provider: DiscoveryProvider,
  address: EthereumAddress,
): Promise<{
  adminAddresses: EthereumAddress[]
  adminThreshold: number
}> {
  const constructorInterface = utils.Fragment.from(
    'constructor(bytes memory params)',
  )
  const result = await provider.getConstructorArgs(address)
  const decodedArgs = utils.defaultAbiCoder.decode(
    constructorInterface.inputs,
    '0x' + result,
  )

  const decodedParams = utils.defaultAbiCoder.decode(
    [
      'address[]', // adminAddresses
      'uint256', // adminThreshold
      'address[]', // ownerAddresses
      'uint256', // ownerThreshold
      'address[]', // operatorAddresses
      'uint256', // operatorThreshold
    ],
    decodedArgs[0] as BytesLike,
  )

  const [adminAddresses, adminThreshold] = decodedParams

  return {
    adminAddresses: (adminAddresses as string[]).map((a) => EthereumAddress(a)),
    adminThreshold: (adminThreshold as BigNumber).toNumber(),
  }
}
