import { ContractParameters } from '@l2beat/discovery-types'
import { assign } from 'comment-json'

import { EthereumAddress } from '../../utils/EthereumAddress'
import { ContractOverrides, DiscoveryOverrides } from './DiscoveryOverrides'

export type MutableOverride = Pick<
  ContractOverrides,
  'ignoreDiscovery' | 'ignoreInWatchMode' | 'ignoreMethods' | 'ignoreRelatives'
>

/**
 * In-place overrides map with intention to be mutable
 * since it is easier to do that this way instead of modification squash
 * @notice Re-assignments made via comments-json `assign` which supports both entries with comments (JSONC) and with out them.
 */
export class MutableDiscoveryOverrides extends DiscoveryOverrides {
  public set(contract: ContractParameters, override: MutableOverride): void {
    const nameOrAddress = this.updateNameToAddress(contract)

    const identifier = this.getIdentifier(nameOrAddress)

    const originalOverride = this.config.overrides?.[identifier] ?? {}

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
        [identifier]: originalOverride,
      })
      // Remove override if it is empty
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete this.config.overrides[identifier]
    }
  }

  private getIdentifier(nameOrAddress: string | EthereumAddress): string {
    let name: string | undefined
    let address: EthereumAddress | undefined

    if (EthereumAddress.check(nameOrAddress.toString())) {
      address = EthereumAddress(nameOrAddress.toString())
      name = this.config.names?.[address.toString()]
    } else {
      address = this.nameToAddress.get(nameOrAddress.toString())
      name = nameOrAddress.toString()
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return name ?? address!.toString()
  }

  // Naive update without checks
  private updateNameToAddress(contract: ContractParameters): string {
    const hasName = Boolean(contract.name)

    if (hasName) {
      this.nameToAddress.set(contract.name, contract.address)

      if (this.config.names === undefined) {
        this.config.names = {
          [contract.address.toString()]: contract.name,
        }
      } else {
        this.config.names[contract.address.toString()] = contract.name
      }
    }

    const addressOrName = hasName ? contract.name : contract.address.toString()

    return addressOrName
  }
}
