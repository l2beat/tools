import { assert } from '@l2beat/backend-tools'
import { ContractValue } from '@l2beat/discovery-types'
import { utils } from 'ethers'
import { reduce } from 'lodash'
import * as z from 'zod'

import { EthereumAddress } from '../../../utils/EthereumAddress'
import { DiscoveryLogger } from '../../DiscoveryLogger'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { ClassicHandler, HandlerResult } from '../Handler'
import { getEventFragment } from '../utils/getEventFragment'
import { toContractValue } from '../utils/toContractValue'
import { toTopics } from '../utils/toTopics'

/**
 * This handler was created specifically for the LayerZero v2 contracts.
 * example event:
 * event DefaultConfigsSet(tuple(uint32 eid, tuple(...) config)[] params)",
 *
 * As there is a lot of similar events, the logic is quite coupled to the event structure
 * for the sake of simplicity. This can be improved in the future if more generic approach is needed.
 *
 * Logic:
 * 1. Get all logs for the event
 * 2. Group logs by returnParam[0] (it is always eid with current approach)
 * 3. Keep only the latest log for each group
 */

export type StateFromEventTupleDefinition = z.infer<
  typeof StateFromEventTupleDefinition
>
export const StateFromEventTupleDefinition = z.strictObject({
  type: z.literal('stateFromEventTuple'),
  event: z.string(),
  returnParam: z.string(),
  ignoreRelative: z.boolean().optional(),
})

export class StateFromEventTupleHandler implements ClassicHandler {
  readonly dependencies: string[] = []
  private readonly fragment: utils.EventFragment
  private readonly abi: utils.Interface

  constructor(
    readonly field: string,
    readonly definition: StateFromEventTupleDefinition,
    abi: string[],
    readonly logger: DiscoveryLogger,
  ) {
    this.fragment = getEventFragment(definition.event, abi, () => true)
    assert(this.fragment.inputs.length === 1, 'Event should have 1 input')
    assert(
      this.fragment.inputs[0]?.name === definition.returnParam,
      `Invalid returnParam, ${this.fragment.inputs[0]?.name ?? ''} expected, ${
        definition.returnParam
      } given`,
    )
    this.abi = new utils.Interface([this.fragment])
  }

  getEvent(): string {
    return this.fragment.format(utils.FormatTypes.full)
  }

  async execute(
    provider: DiscoveryProvider,
    address: EthereumAddress,
    blockNumber: number,
  ): Promise<HandlerResult> {
    this.logger.logExecution(this.field, ['Querying ', this.fragment.name])
    const topics = toTopics(this.abi, this.fragment)
    // todo: are we sure that logs are sorted by blockNumber?
    const logs = await provider.getLogs(address, topics, 0, blockNumber)

    const values = new Map<number, ContractValue>()
    for (const log of logs) {
      const parsed = this.abi.parseLog(log)
      const params = reduce(
        parsed.args,
        (acc, value, key) => {
          acc[key] = toContractValue(value) as [number, ContractValue][]
          return acc
        },
        {} as Record<string, [number, ContractValue][]>,
      )
      for (const array of Object.values(params)) {
        assert(Array.isArray(array), 'Invalid param type')
        for (const tuple of array) {
          values.set(tuple[0], tuple[1])
        }
      }
    }

    const value = Object.fromEntries(values.entries())

    return {
      field: this.field,
      value,
      ignoreRelative: this.definition.ignoreRelative,
    }
  }
}
