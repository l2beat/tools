import { ContractValue } from '@l2beat/discovery-types'
import { utils } from 'ethers'

import { Bytes } from '../../../utils/bytes'
import { EthereumAddress } from '../../../utils/EthereumAddress'
import { getErrorMessage } from '../../../utils/getErrorMessage'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { isRevert } from '../../utils/isRevert'
import { toContractValue } from './toContractValue'

export const EXEC_REVERT_MSG = 'Execution reverted'

export async function callMethod(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  fragment: utils.FunctionFragment,
  parameters: unknown[],
  blockNumber: number,
): Promise<
  | {
      value: ContractValue | undefined
      error?: undefined
    }
  | {
      error: any
      value?: undefined
    }
> {
  const abi = new utils.Interface([fragment])
  try {
    const callData = Bytes.fromHex(abi.encodeFunctionData(fragment, parameters))
    const result = await provider.call(address, callData, blockNumber)
    const decoded = abi.decodeFunctionResult(fragment, result.toString())
    const mapped = decoded.map(toContractValue)
    return {
      value: mapped.length === 1 ? mapped[0] : mapped,
    }
  } catch (e) {
    return {
      error: isRevert(e) ? EXEC_REVERT_MSG : getErrorMessage(e),
    }
  }
}
