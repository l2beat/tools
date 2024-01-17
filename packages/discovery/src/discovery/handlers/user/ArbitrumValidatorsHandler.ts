import { providers, utils } from 'ethers'
import * as z from 'zod'

import { EthereumAddress } from '../../../utils/EthereumAddress'
import { Hash256 } from '../../../utils/Hash256'
import { DiscoveryLogger } from '../../DiscoveryLogger'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { Trace } from '../../provider/TransactionTrace'
import { ClassicHandler, HandlerResult } from '../Handler'

export type ArbitrumValidatorsHandlerDefinition = z.infer<
  typeof ArbitrumValidatorsHandlerDefinition
>
export const ArbitrumValidatorsHandlerDefinition = z.strictObject({
  type: z.literal('arbitrumValidators'),
})

export class ArbitrumValidatorsHandler implements ClassicHandler {
  readonly dependencies: string[] = []
  readonly setValidatorFn = 'setValidator(address[] _validator, bool[] _val)'
  readonly ownerFunctionCalledEvent = 'OwnerFunctionCalled(uint256 indexed id)'
  readonly interface = new utils.Interface([
    `function ${this.setValidatorFn}`,
    `event ${this.ownerFunctionCalledEvent}`,
  ])
  readonly setValidatorSighash = this.interface.getSighash(this.setValidatorFn)

  constructor(
    readonly field: string,
    readonly logger: DiscoveryLogger,
  ) {}

  async execute(
    provider: DiscoveryProvider,
    address: EthereumAddress,
    blockNumber: number,
  ): Promise<HandlerResult> {
    this.logger.logExecution(this.field, ['Fetching Arbitrum Validators'])

    // Find transactions in which setValidator() was called
    const logs = await this.getRelevantLogs(provider, address, blockNumber)
    const txHashes = logs.map((log) => Hash256(log.transactionHash))

    // Extract setValidator call parameters from transaction traces and process them
    const isValidator: Record<string, boolean> = {}
    for (const txHash of txHashes) {
      const traces = await provider.getTransactionTrace(txHash)
      traces.forEach((trace) => this.processTrace(trace, isValidator))
    }

    const activeValidators = Object.keys(isValidator).filter(
      (key) => isValidator[key],
    )
    activeValidators.sort()

    return {
      field: this.field,
      value: activeValidators,
    }
  }

  private async getRelevantLogs(
    provider: DiscoveryProvider,
    address: EthereumAddress,
    blockNumber: number,
  ): Promise<providers.Log[]> {
    const topic0 = this.interface.getEventTopic(this.ownerFunctionCalledEvent)
    // when setValidator is called, the event is emitted with parameter "6"
    const topic1 = utils.defaultAbiCoder.encode(['uint256'], [6])
    const logs = await provider.getLogs(
      address,
      [topic0, topic1],
      0,
      blockNumber,
    )
    return logs
  }

  processTrace(trace: Trace, isValidator: Record<string, boolean>): void {
    if (trace.type !== 'call') return
    if (trace.action.callType !== 'delegatecall') return

    const input = trace.action.input
    if (!input.startsWith(this.setValidatorSighash)) return

    const decodedInput = this.interface.decodeFunctionData(
      this.setValidatorFn,
      input,
    )
    const addresses = decodedInput[0] as string[]
    const flags = decodedInput[1] as boolean[]

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i]
      const flag = flags[i]
      if (address === undefined || flag === undefined) {
        throw new Error(`Invalid input to ${this.setValidatorFn}`)
      }
      isValidator[address] = flag
    }
  }
}
