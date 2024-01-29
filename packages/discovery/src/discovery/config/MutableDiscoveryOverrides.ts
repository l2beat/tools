import { ContractParameters } from '@l2beat/discovery-types'

import { EthereumAddress } from '../../utils/EthereumAddress'
import { ContractOverrides, DiscoveryOverrides } from './DiscoveryOverrides'

export type MutableOverride = Pick<
  ContractOverrides,
  'ignoreDiscovery' | 'ignoreInWatchMode' | 'ignoreMethods'
>

export class MutableDiscoveryOverrides extends DiscoveryOverrides {
  public set(contract: ContractParameters, override: MutableOverride): void {
    const nameOrAddress = this.updateNameToAddress(contract)

    const identifier = this.getIdentifier(nameOrAddress)

    const originalOverride = identifier
      ? this.config.overrides?.[identifier] ?? {}
      : {}

    if (override.ignoreInWatchMode !== undefined) {
      if (override.ignoreInWatchMode.length === 0) {
        delete originalOverride.ignoreInWatchMode
      } else {
        originalOverride.ignoreInWatchMode = override.ignoreInWatchMode
      }
    }

    if (override.ignoreMethods !== undefined) {
      if (override.ignoreMethods.length === 0) {
        delete originalOverride.ignoreMethods
      } else {
        originalOverride.ignoreMethods = override.ignoreMethods
      }
    }

    if (override.ignoreDiscovery !== undefined) {
      if (!override.ignoreDiscovery) {
        delete originalOverride.ignoreDiscovery
      } else {
        originalOverride.ignoreDiscovery = override.ignoreDiscovery
      }
    }

    if (this.config.overrides === undefined) {
      this.config.overrides = {}
    }

    this.config.overrides[identifier ?? nameOrAddress] = originalOverride
  }

  private getIdentifier(
    nameOrAddress: string | EthereumAddress,
  ): string | null {
    let name: string | undefined
    let address: EthereumAddress | undefined

    if (EthereumAddress.check(nameOrAddress.toString())) {
      address = EthereumAddress(nameOrAddress.toString())
      name = this.config.names?.[address.toString()]
    } else {
      address = this.nameToAddress.get(nameOrAddress.toString())
      name = nameOrAddress.toString()
    }

    return name ?? address?.toString() ?? null
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
