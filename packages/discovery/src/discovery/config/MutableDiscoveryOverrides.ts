import { ContractParameters } from '@l2beat/discovery-types'
import { assign } from 'comment-json'

import { ContractOverrides, DiscoveryOverrides } from './DiscoveryOverrides'

export type MutableOverride = Pick<
  ContractOverrides,
  'ignoreDiscovery' | 'ignoreInWatchMode' | 'ignoreMethods' | 'ignoreRelatives'
>

/**
 * @notice Re-assignments made via comments-json `assign` which supports both entries with comments (JSONC) and with out them.
 */
export class MutableDiscoveryOverrides extends DiscoveryOverrides {
  public set(contract: ContractParameters, override: MutableOverride): void {
    const hasName = Boolean(contract.name)

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const nameOrAddress = hasName ? contract.name : contract.address.toString()!

    const originalOverride = this.config.overrides?.[nameOrAddress] ?? {}

    if (override.ignoreInWatchMode !== undefined) {
      if (override.ignoreInWatchMode.length === 0) {
        delete originalOverride.ignoreInWatchMode
      } else {
        assign(originalOverride, {
          ignoreInWatchMode: override.ignoreInWatchMode,
        })
      }
    }

    if (override.ignoreMethods !== undefined) {
      if (override.ignoreMethods.length === 0) {
        delete originalOverride.ignoreMethods
      } else {
        assign(originalOverride, { ignoreMethods: override.ignoreMethods })
      }
    }

    if (override.ignoreRelatives !== undefined) {
      if (override.ignoreRelatives.length === 0) {
        delete originalOverride.ignoreRelatives
      } else {
        assign(originalOverride, { ignoreRelatives: override.ignoreRelatives })
      }
    }

    if (override.ignoreDiscovery !== undefined) {
      if (!override.ignoreDiscovery) {
        delete originalOverride.ignoreDiscovery
      } else {
        assign(originalOverride, { ignoreDiscovery: override.ignoreDiscovery })
      }
    }

    // Pre-set overrides if they are not set
    if (this.config.overrides === undefined) {
      this.config.overrides = {}
    }

    // Set override only if it is not empty
    if (Object.keys(originalOverride).length > 0) {
      assign(this.config.overrides, {
        [nameOrAddress]: originalOverride,
      })
      // Remove override if it is empty
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.config.overrides[nameOrAddress]
    }
  }
}
