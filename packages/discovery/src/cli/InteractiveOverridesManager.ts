import { assert } from '@l2beat/backend-tools'
import { ContractParameters, DiscoveryOutput } from '@l2beat/discovery-types'
import { parse, stringify } from 'comment-json'
import * as fs from 'fs/promises'

import { DiscoveryConfig } from '../discovery/config/DiscoveryConfig'
import { ContractOverrides } from '../discovery/config/DiscoveryOverrides'
import {
  MutableDiscoveryOverrides,
  MutableOverride,
} from '../discovery/config/MutableDiscoveryOverrides'
import { RawDiscoveryConfig } from '../discovery/config/RawDiscoveryConfig'

export class InteractiveOverridesManager {
  private readonly mutableOverrides: MutableDiscoveryOverrides

  constructor(
    private readonly output: DiscoveryOutput,
    private readonly config: DiscoveryConfig,
  ) {
    this.mutableOverrides = new MutableDiscoveryOverrides(this.config.raw)
  }

  getContracts(): ContractParameters[] {
    return [...this.output.contracts]
  }

  getWatchMode(contract: ContractParameters): {
    all: string[]
    ignored: string[]
  } {
    const isDiscoveryIgnored = this.getIgnoreDiscovery(contract)
    const ignoredMethods = this.getIgnoredMethods(contract)

    if (isDiscoveryIgnored) {
      return {
        all: [],
        ignored: [],
      }
    }

    const overrides = this.getSafeOverride(contract)

    const allProperties = Object.keys(contract.values ?? {})

    const ignoredInWatchMode = overrides?.ignoreInWatchMode ?? []

    const possibleMethods = allProperties
      .filter((method) => !this.isCustomHandler(contract, method))
      .filter((method) => !ignoredMethods.ignored.includes(method))

    return {
      all: possibleMethods,
      ignored: ignoredInWatchMode,
    }
  }

  getIgnoredMethods(contract: ContractParameters): {
    all: string[]
    ignored: string[]
  } {
    const isDiscoveryIgnored = this.getIgnoreDiscovery(contract)

    if (isDiscoveryIgnored) {
      return {
        all: [],
        ignored: [],
      }
    }

    const overrides = this.getSafeOverride(contract)

    const methods = overrides?.ignoreMethods ?? []

    const allProperties = Object.keys(contract.values ?? {})
    const possibleMethods = allProperties.filter(
      (method) => !this.isCustomHandler(contract, method),
    )

    const ignored = possibleMethods.filter((method) => methods.includes(method))

    return {
      all: possibleMethods,
      ignored,
    }
  }

  getIgnoreDiscovery(contract: ContractParameters): boolean {
    const overrides = this.getSafeOverride(contract)

    return overrides?.ignoreDiscovery ?? false
  }

  /**
   * Enforce consistency
   */
  setOverride(contract: ContractParameters, override: MutableOverride): void {
    // Optimistically set overrides
    this.mutableOverrides.set(contract, override)

    const isDiscoveryIgnored = this.getIgnoreDiscovery(contract)
    const ignoredInWatchMode = this.getWatchMode(contract)
    const ignoredMethods = this.getIgnoredMethods(contract)

    /** Consistency rules */
    if (isDiscoveryIgnored) {
      this.mutableOverrides.set(contract, {
        ignoreDiscovery: true,
        ignoreInWatchMode: [],
        ignoreMethods: [],
      })
      return
    }

    // Exclude ignoreMethods from watch mode completely
    const validWatchMode = ignoredInWatchMode.ignored.filter(
      (method) => !ignoredMethods.ignored.includes(method),
    )

    this.mutableOverrides.set(contract, {
      ignoreInWatchMode: validWatchMode,
    })
  }

  /**
   * Do not replace whole file, just read most-recent raw, replace and save overrides
   */
  async flushOverrides(): Promise<void> {
    const path = `discovery/${this.output.name}/${this.output.chain}/config.jsonc`

    const fileContents = await fs.readFile(path, 'utf8')

    const parsed = parse(fileContents) as RawDiscoveryConfig | null

    assert(parsed, 'Cannot parse file')

    if (this.mutableOverrides.config.overrides) {
      parsed.overrides = this.mutableOverrides.config.overrides
    }

    if (this.mutableOverrides.config.names) {
      parsed.names = this.mutableOverrides.config.names
    }

    await fs.writeFile(path, stringify(parsed, null, 2))
  }

  private getOverrideIdentity(contract: ContractParameters): string {
    const hasName = Boolean(
      this.mutableOverrides.config.names?.[contract.address.toString()],
    )

    if (hasName) {
      return contract.name
    }

    return contract.address.toString()
  }

  private getSafeOverride(
    contract: ContractParameters,
  ): ContractOverrides | null {
    const addressOrName = this.getOverrideIdentity(contract)

    try {
      return this.mutableOverrides.get(addressOrName)
    } catch {
      return null
    }
  }

  private isCustomHandler(
    contract: ContractParameters,
    property: string,
  ): boolean {
    const addressOrName = this.getOverrideIdentity(contract)

    return Object.keys(
      this.mutableOverrides.get(addressOrName).fields ?? {},
    ).includes(property)
  }
}
