import { assert } from '@l2beat/backend-tools'
import { utils } from 'ethers'
import * as z from 'zod'

import { Bytes } from '../../../utils/Bytes'
import { EthereumAddress } from '../../../utils/EthereumAddress'
import { getErrorMessage } from '../../../utils/getErrorMessage'
import { DiscoveryLogger } from '../../DiscoveryLogger'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { Handler, HandlerResult } from '../Handler'
import { getReferencedName, Reference, resolveReference } from '../reference'
import { BytesFromString, NumberFromString } from '../types'
import { bytes32ToContractValue } from '../utils/bytes32ToContractValue'
import { valueToBigInt } from '../utils/valueToBigInt'

const SingleSlot = z.union([
  z.number().int().nonnegative(),
  BytesFromString,
  NumberFromString,
  Reference,
])

export type DynamicArrayHandlerDefinition = z.infer<
  typeof DynamicArrayHandlerDefinition
>
export const DynamicArrayHandlerDefinition = z.strictObject({
  type: z.literal('dynamicArray'),
  slot: SingleSlot,
  returnType: z.optional(z.enum(['address'])),
  ignoreRelative: z.optional(z.boolean()),
})

export class DynamicArrayHandler implements Handler {
  readonly dependencies: string[]

  constructor(
    readonly field: string,
    private readonly definition: DynamicArrayHandlerDefinition,
    readonly logger: DiscoveryLogger,
  ) {
    this.dependencies = getDependencies(definition)
  }

  async execute(
    provider: DiscoveryProvider,
    address: EthereumAddress,
    blockNumber: number,
    previousResults: Record<string, HandlerResult | undefined>,
  ): Promise<HandlerResult> {
    this.logger.logExecution(this.field, ['Reading dynamic array storage'])
    const resolved = resolveDependencies(this.definition, previousResults)

    const elementStorages: Bytes[] = []
    try {
      const lengthSlot = resolved.slot
      const lengthStorage = await provider.getStorage(
        address,
        lengthSlot,
        blockNumber,
      )
      const length = bytes32ToContractValue(lengthStorage, 'number')

      assert(typeof length === 'number')
      for (let index = 0n; index < length; index++) {
        const elementSlot = computeDynamicSlot(lengthSlot, index)
        const elementStorage = await provider.getStorage(
          address,
          elementSlot,
          blockNumber,
        )
        elementStorages.push(elementStorage)
      }
    } catch (e) {
      return { field: this.field, error: getErrorMessage(e) }
    }

    return {
      field: this.field,
      value: elementStorages.map((e) =>
        bytes32ToContractValue(e, resolved.returnType),
      ),
      ignoreRelative: this.definition.ignoreRelative,
    }
  }
}

function getDependencies(definition: DynamicArrayHandlerDefinition): string[] {
  const dependencies: string[] = []
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const add = (value: string | undefined) => value && dependencies.push(value)

  add(getReferencedName(definition.slot))
  if (Array.isArray(definition.slot)) {
    for (const value of definition.slot) {
      add(getReferencedName(value))
    }
  }
  return dependencies
}

function resolveDependencies(
  definition: DynamicArrayHandlerDefinition,
  previousResults: Record<string, HandlerResult | undefined>,
): {
  slot: bigint
  returnType: 'number' | 'address' | 'bytes'
} {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const resolved = resolveReference(definition.slot, previousResults)
  const slot = valueToBigInt(resolved)

  const returnType = definition.returnType ?? 'address'

  return {
    slot,
    returnType,
  }
}

function computeDynamicSlot(lengthSlot: bigint, index: bigint): bigint {
  return hashBigints([lengthSlot]) + index
}

function hashBigints(values: bigint[]): bigint {
  return BigInt(
    utils.keccak256(
      utils.defaultAbiCoder.encode(
        values.map(() => 'uint256'),
        values,
      ),
    ),
  )
}