import { assert } from '@l2beat/backend-tools'
import { ContractValue } from '@l2beat/discovery-types'
import { ethers } from 'ethers'
import { z } from 'zod'

import { EthereumAddress } from '../../../utils/EthereumAddress'
import { DiscoveryLogger } from '../../DiscoveryLogger'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { Handler, HandlerResult } from '../Handler'

export type ConstructorArgsDefinition = z.infer<
  typeof ConstructorArgsDefinition
>
export const ConstructorArgsDefinition = z.strictObject({
  type: z.literal('constructorArgs'),
})

export class ConstructorArgsHandler implements Handler {
  readonly dependencies: string[] = []
  readonly constructorFragment: ethers.utils.Fragment

  constructor(
    readonly field: string,
    abi: string[],
    readonly logger: DiscoveryLogger,
  ) {
    assert(
      field === 'constructorArgs',
      'ConstructorArgsHandler can only be used for "constructorArgs" field',
    )

    const constructorFragment = new ethers.utils.Interface(abi).fragments.find(
      (f) => f.type === 'constructor',
    )
    assert(constructorFragment, 'Constructor does not exist in abi')
    this.constructorFragment = constructorFragment
  }

  async execute(
    provider: DiscoveryProvider,
    address: EthereumAddress,
  ): Promise<HandlerResult> {
    const encodedConstructorArguments =
      await provider.getConstructorArgs(address)

    const decodedConstructorArguments = ethers.utils.defaultAbiCoder.decode(
      this.constructorFragment.inputs,
      '0x' + encodedConstructorArguments,
    )

    return {
      field: 'constructorArgs',
      value: serializeResult(decodedConstructorArguments),
    }
  }
}

/** @internal */
export function serializeResult(result: ethers.utils.Result): ContractValue {
  if (Array.isArray(result)) {
    return result.map(serializeResult)
  }

  if (result instanceof ethers.BigNumber) {
    return result.toString()
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (result && typeof result === 'object') {
    return Object.fromEntries(
      Object.entries(result).map(([key, value]) => [
        key,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        serializeResult(value),
      ]),
    )
  }

  if (
    typeof result === 'string' ||
    typeof result === 'number' ||
    typeof result === 'boolean'
  ) {
    return result
  }

  throw new Error(`Don't know how to serialize: ${typeof result}`)
}
