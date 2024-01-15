import * as z from 'zod'

import { EthereumAddress } from '../../../utils/EthereumAddress'
import { Hash256 } from '../../../utils/Hash256'
import { DiscoveryLogger } from '../../DiscoveryLogger'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
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

    // get traces of all those transactions
    for (const txHash of txHashes) {
      const traces = await provider.getTransactionTrace(txHash)
      console.log(traces)
    }

    return {
      field: this.field,
      value: 0,
    }
  }
}
