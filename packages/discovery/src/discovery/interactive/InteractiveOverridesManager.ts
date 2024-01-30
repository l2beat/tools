import { ContractParameters, DiscoveryOutput } from '@l2beat/discovery-types'
import { assign, parse, stringify } from 'comment-json'
import * as fs from 'fs/promises'

import { ContractOverrides } from '../config/DiscoveryOverrides'
import {
  MutableDiscoveryOverrides,
  MutableOverride,
} from '../config/MutableDiscoveryOverrides'
import { RawDiscoveryConfig } from '../config/RawDiscoveryConfig'

interface IgnoreResult {
  possible: string[]
  ignored: string[]
}

export class InteractiveOverridesManager {
  private readonly mutableOverrides: MutableDiscoveryOverrides

  constructor(
    private readonly output: DiscoveryOutput,
    private readonly rawConfigWithComments: RawDiscoveryConfig,
  ) {
    this.mutableOverrides = new MutableDiscoveryOverrides(
      this.rawConfigWithComments,
    )
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

    // All discovered keys + look ahead for all ignored methods
    const possibleMethods = [
      ...new Set([...allProperties, ...ignoredMethods.possible]),
    ]
      .filter((method) => !this.isCustomHandler(contract, method))
      .filter((method) => !ignoredMethods.ignored.includes(method))

    return {
      all: possibleMethods,
      ignored: ignoredInWatchMode,
    }
  }

  getIgnoredRelatives(contract: ContractParameters): IgnoreResult {
    const isDiscoveryIgnored = this.getIgnoreDiscovery(contract)
    const ignoredMethods = this.getIgnoredMethods(contract)

    if (isDiscoveryIgnored) {
      return {
        possible: [],
        ignored: [],
      }
    }

    const overrides = this.getSafeOverride(contract)

    const allProperties = Object.keys(contract.values ?? {})

    const ignoredRelatives = overrides?.ignoreRelatives ?? []

    // All discovered keys + look ahead for all ignored methods
    const possibleMethods = [
      ...new Set([...allProperties, ...ignoredMethods.possible]),
    ]
      .filter((method) => !this.isCustomHandler(contract, method))
      .filter((method) => !ignoredMethods.ignored.includes(method))

    return {
      possible: possibleMethods,
      ignored: ignoredRelatives,
    }
  }

  getIgnoredMethods(contract: ContractParameters): IgnoreResult {
    const isDiscoveryIgnored = this.getIgnoreDiscovery(contract)

    if (isDiscoveryIgnored) {
      return {
        possible: [],
        ignored: [],
      }
    }

    const overrides = this.getSafeOverride(contract)

    const ignoredMethods = overrides?.ignoreMethods ?? []

    const allProperties = Object.keys(contract.values ?? {})

    const possibleMethods = [
      ...new Set([...allProperties, ...ignoredMethods]),
    ].filter((method) => !this.isCustomHandler(contract, method))

    return {
      possible: possibleMethods,
      ignored: ignoredMethods,
    }
  }

  getIgnoreDiscovery(contract: ContractParameters): boolean {
    const overrides = this.getSafeOverride(contract)

    return overrides?.ignoreDiscovery ?? false
  }

  setOverride(contract: ContractParameters, override: MutableOverride): void {
    // Optimistically set overrides
    this.mutableOverrides.set(contract, override)

    const isDiscoveryIgnored = this.getIgnoreDiscovery(contract)
    const ignoredInWatchMode = this.getWatchMode(contract)
    const ignoredMethods = this.getIgnoredMethods(contract)
    const ignoredRelatives = this.getIgnoredRelatives(contract)

    // Wipe all overrides if discovery is ignored
    if (isDiscoveryIgnored) {
      this.mutableOverrides.set(contract, {
        ignoreDiscovery: true,
        ignoreInWatchMode: [],
        ignoreMethods: [],
        ignoreRelatives: [],
      })
      return
    }

    // Exclude ignoreMethods from watch mode and relatives completely
    const validWatchMode = ignoredInWatchMode.ignored.filter(
      (method) => !ignoredMethods.ignored.includes(method),
    )

    const validRelatives = ignoredRelatives.ignored.filter(
      (method) => !ignoredMethods.ignored.includes(method),
    )

    this.mutableOverrides.set(contract, {
      ignoreInWatchMode: validWatchMode,
      ignoreRelatives: validRelatives,
    })
  }

  /**
   * Do not replace whole file, just read most-recent raw, replace and save overrides
   */
  async flushOverrides(): Promise<void> {
    const path = `discovery/${this.output.name}/${this.output.chain}/config.jsonc`

    const fileContents = await fs.readFile(path, 'utf8')

    const parsed = parse(fileContents) as RawDiscoveryConfig | null

    if (this.mutableOverrides.config.overrides) {
      assign(parsed, { overrides: this.mutableOverrides.config.overrides })
    }

    if (this.mutableOverrides.config.names) {
      assign(parsed, { names: this.mutableOverrides.config.names })
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
