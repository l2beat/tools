import { utils } from 'ethers'
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

  constructor(
    readonly field: string,
    readonly definition: ArbitrumValidatorsHandlerDefinition,
    abi: string[],
    readonly logger: DiscoveryLogger,
  ) {}

  async execute(
    provider: DiscoveryProvider,
    address: EthereumAddress,
    blockNumber: number,
  ): Promise<HandlerResult> {
    this.logger.logExecution(this.field, ['Fetching Arbitrum Validators'])
    const logs = await provider.getLogs(
      address,
      [
        // event OwnerFunctionCalled(uint256 indexed id);
        '0xea8787f128d10b2cc0317b0c3960f9ad447f7f6c1ed189db1083ccffd20f456e',
        // id == 6 is emitted inside setValidator()
        '0x0000000000000000000000000000000000000000000000000000000000000006',
      ],
      0,
      blockNumber,
    )

    const txHashes = logs.map((log) => Hash256(log.transactionHash))

    const validatorMap: Record<string, boolean> = {}
    for (const txHash of txHashes) {
      const traces = await provider.getTransactionTrace(txHash)
      traces.forEach((trace) => this.parseTrace(trace, validatorMap))
    }

    const validatorsSetToTrue = Object.keys(validatorMap).filter(
      (key) => validatorMap[key],
    )
    validatorsSetToTrue.sort()

    return {
      field: this.field,
      value: validatorsSetToTrue,
    }
  }

  parseTrace(trace: Trace, validatorMap: Record<string, boolean>): void {
    if (trace.type !== 'call') return
    if (trace.action.callType !== 'delegatecall') return

    const fnSignature = 'setValidator(address[] _validator, bool[] _val)'
    const i = new utils.Interface([`function ${fnSignature}`])
    const input = trace.action.input
    if (!input.startsWith(i.getSighash(fnSignature))) return

    const decodedInput = i.decodeFunctionData(fnSignature, input)
    const addresses = decodedInput[0] as string[]
    const flags = decodedInput[1] as boolean[]

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i]
      const flag = flags[i]
      if (address === undefined || flag === undefined) {
        throw new Error(`Invalid input to ${fnSignature}`)
      }
      validatorMap[address] = flag
    }
  }
}
