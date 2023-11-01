import { assert } from '@l2beat/backend-tools'
import { utils } from 'ethers'

import { Bytes } from '../../utils/Bytes'
import { EthereumAddress } from '../../utils/EthereumAddress'
import { DiscoveryProvider } from '../provider/DiscoveryProvider'
import { isRevert } from './isRevert'

export async function getCallResult<T>(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  methodAbi: string,
  values: unknown[],
  blockNumber: number,
  resultLength = 1,
): Promise<T | undefined> {
  try {
    return await getCallResultWithRevert<T>(
      provider,
      address,
      methodAbi,
      values,
      blockNumber,
      resultLength,
    )
  } catch (e) {
    if (isRevert(e)) {
      return undefined
    }
    throw e
  }
}

export async function getCallResultWithRevert<T>(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  methodAbi: string,
  values: unknown[],
  blockNumber: number,
  resultLength: number,
): Promise<T | undefined> {
  assert(resultLength > 0, 'Result length must be positive')

  const abi = new utils.Interface([methodAbi])
  const fragment = Object.values(abi.functions)[0]

  assert(fragment, `Unknown fragment for method: ${methodAbi}`)
  const callData = Bytes.fromHex(abi.encodeFunctionData(fragment, values))
  const result = await provider.call(address, callData, blockNumber)
  const decodedResult = abi.decodeFunctionResult(fragment, result.toString())
  return (
    resultLength === 1 ? decodedResult[0] : decodedResult.slice(0, resultLength)
  ) as T
}
