import { ContractValue } from '@l2beat/discovery-types'
import { utils } from 'ethers'
import * as z from 'zod'

import { EthereumAddress } from '../../../utils/EthereumAddress'
import { DiscoveryLogger } from '../../DiscoveryLogger'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { ClassicHandler, HandlerResult } from '../Handler'
import { getReferencedName, Reference, resolveReference } from '../reference'
import { callMethod } from '../utils/callMethod'
import { getFunctionFragment } from '../utils/getFunctionFragment'
import { valueToNumber } from '../utils/valueToNumber'

export type ArrayHandlerDefinition = z.infer<typeof ArrayHandlerDefinition>
export const ArrayHandlerDefinition = z.strictObject({
  type: z.literal('array'),
  indices: z.optional(z.union([z.array(z.number()), z.string()])),
  method: z.optional(z.string()),
  length: z.optional(z.union([z.number().int().nonnegative(), Reference])),
  maxLength: z.optional(z.number().int().nonnegative()),
  startIndex: z.optional(z.number().int().nonnegative()),
  ignoreRelative: z.optional(z.boolean()),
})

const DEFAULT_MAX_LENGTH = 100

export class ArrayHandler implements ClassicHandler {
  readonly dependencies: string[] = []
  readonly fragment: utils.FunctionFragment

  constructor(
    readonly field: string,
    private readonly definition: ArrayHandlerDefinition,
    abi: string[],
    readonly logger: DiscoveryLogger,
  ) {
    const dependency = getReferencedName(definition.length)
    if (dependency) {
      this.dependencies.push(dependency)
    }
    const indicesDependency = getReferencedName(definition.indices)
    if (indicesDependency) {
      this.dependencies.push(indicesDependency)
    }
    this.fragment = getFunctionFragment(
      definition.method ?? field,
      abi,
      isArrayFragment,
    )
  }

  getMethod(): string {
    return this.fragment.format(utils.FormatTypes.full)
  }

  async execute(
    provider: DiscoveryProvider,
    address: EthereumAddress,
    blockNumber: number,
    previousResults: Record<string, HandlerResult | undefined>,
  ): Promise<HandlerResult> {
    this.logger.logExecution(this.field, [
      'Calling array ',
      this.fragment.name + '(i)',
    ])
    const resolved = resolveDependencies(this.definition, previousResults)

    const value: ContractValue[] = []
    const startIndex = resolved.startIndex
    const maxLength = Math.min(resolved.maxLength, resolved.length ?? Infinity)
    const callIndex = createCallIndex(
      provider,
      address,
      this.fragment,
      blockNumber,
    )
    if (resolved.indices) {
      for (const index of resolved.indices) {
        const current = await callIndex(index)
        if (current.error) {
          if (
            current.error !== 'Execution reverted' ||
            resolved.length !== undefined
          ) {
            return { field: this.field, error: current.error }
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        value.push(current.value!)
      }
    } else {
      for (let i = startIndex; i < maxLength + startIndex; i++) {
        const current = await callIndex(i)
        if (current.error) {
          if (
            current.error !== 'Execution reverted' ||
            resolved.length !== undefined
          ) {
            // FIXME: Had no eslint ignore here
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            return { field: this.field, error: current.error }
          }
          break
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        value.push(current.value!)
      }
    }
    if (
      value.length === resolved.maxLength &&
      value.length !== resolved.length
    ) {
      return {
        field: this.field,
        value,
        error: 'Too many values. Provide a higher maxLength value',
      }
    }
    return { field: this.field, value, ignoreRelative: resolved.ignoreRelative }
  }
}
function createCallIndex(
  provider: DiscoveryProvider,
  address: EthereumAddress,
  fragment: utils.FunctionFragment,
  blockNumber: number,
) {
  return async (index: number) => {
    return await callMethod(provider, address, fragment, [index], blockNumber)
  }
}

function resolveDependencies(
  definition: ArrayHandlerDefinition,
  previousResults: Record<string, HandlerResult | undefined>,
): {
  method: string | undefined
  length: number | undefined
  indices: number[] | undefined
  maxLength: number
  startIndex: number
  ignoreRelative: boolean | undefined
} {
  let length: number | undefined
  if (definition.length !== undefined) {
    const resolved = resolveReference(definition.length, previousResults)
    length = valueToNumber(resolved)
  }

  let indices: number[] | undefined
  if (
    definition.indices !== undefined &&
    typeof definition.indices === 'string'
  ) {
    const resolved = resolveReference(definition.indices, previousResults)
    if (!Array.isArray(resolved)) {
      throw new Error('Expected array of indices')
    }
    indices = resolved.map((v) => valueToNumber(v))
  } else {
    indices = definition.indices
  }

  if (indices !== undefined && length !== undefined) {
    throw new Error('Cannot define both indices and length')
  }

  return {
    method: definition.method,
    indices,
    length,
    maxLength: definition.maxLength ?? DEFAULT_MAX_LENGTH,
    startIndex: definition.startIndex ?? 0,
    ignoreRelative: definition.ignoreRelative,
  }
}

function isArrayFragment(fragment: utils.FunctionFragment): boolean {
  return (
    (fragment.stateMutability === 'view' ||
      fragment.stateMutability === 'pure') &&
    fragment.inputs.length === 1 &&
    (fragment.inputs[0]?.type === 'uint256' ||
      fragment.inputs[0]?.type === 'uint16')
  )
}
