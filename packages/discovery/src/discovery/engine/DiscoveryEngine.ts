import { DiscoveryOutput } from '@l2beat/discovery-types'

import { AddressAnalyzer, Analysis } from '../analysis/AddressAnalyzer'
import { DiscoveryConfig } from '../config/DiscoveryConfig'
import { DiscoveryLogger } from '../DiscoveryLogger'
import { DiscoveryStack } from './DiscoveryStack'
import { shouldSkip } from './shouldSkip'

// Bump this value when the logic of discovery changes,
// causing a difference in discovery output

// Last change: add implementations to the output
export const DISCOVERY_LOGIC_VERSION = 3
export class DiscoveryEngine {
  constructor(
    private readonly addressAnalyzer: AddressAnalyzer,
    private readonly logger: DiscoveryLogger,
  ) {}

  async discover(
    config: DiscoveryConfig,
    blockNumber: number,
  ): Promise<Analysis[]> {
    const resolved: Analysis[] = []
    const stack = new DiscoveryStack()
    stack.push(config.initialAddresses, 0)

    while (!stack.isEmpty()) {
      const item = stack.pop()

      const reason = shouldSkip(item, config)
      if (reason) {
        this.logger.logSkip(item.address, reason)
        continue
      }

      this.logger.log(`Analyzing ${item.address.toString()}`)
      const { analysis, relatives } = await this.addressAnalyzer.analyze(
        item.address,
        config.overrides.get(item.address),
        blockNumber,
      )
      resolved.push(analysis)

      const newRelatives = stack.push(relatives, item.depth + 1)
      this.logger.logRelatives(newRelatives)
    }

    this.logger.flush(config.name)

    this.checkErrors(resolved)

    return resolved
  }

  async watch(
    config: DiscoveryConfig,
    prevOutput: DiscoveryOutput,
    blockNumber: number,
  ): Promise<{ changed: boolean }> {
    const contracts = prevOutput.contracts

    const contractsChanged = await Promise.all(
      contracts.map(async (contract) => {
        const overrides = config.overrides.get(contract.address)

        return await this.addressAnalyzer.watchContract(
          contract,
          overrides,
          blockNumber,
          prevOutput.abis,
        )
      }),
    )

    if (contractsChanged.some((x) => x)) {
      this.logger.log('Some contracts changed')
      return { changed: true }
    }

    const eoas = prevOutput.eoas
    const eoasChanged = await Promise.all(
      eoas.map(async (eoa) => {
        return await this.addressAnalyzer.watchEoa(eoa, blockNumber)
      }),
    )

    if (eoasChanged.some((x) => x)) {
      this.logger.log('Some EOAs changed')
      return { changed: true }
    }

    return { changed: false }
  }

  private checkErrors(resolved: Analysis[]): void {
    let errors = 0
    for (const analysis of resolved) {
      if (analysis.type === 'Contract') {
        errors += Object.keys(analysis.errors).length
      }
    }
    if (errors > 0) {
      this.logger.logError(`Errors during discovery: ${errors}`)
    }
  }
}
