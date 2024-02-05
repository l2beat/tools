import { zip } from 'lodash'

import { EthereumAddress } from '../../utils/EthereumAddress'
import { DiscoveryProvider } from '../provider/DiscoveryProvider'
import { deduplicateAbi } from './deduplicateAbi'
import { getLegacyDerivedName } from './getDerivedName'
import { getRemappings, processSources } from './processSources'
import { skipIgnoredFunctions } from './skipIgnoredFunctions'

export interface ContractSources {
  name: string
  isVerified: boolean
  abi: string[]
  abis: Record<string, string[]>
  files: Record<string, string>[]
  remappings: string[]
}

export class SourceCodeService {
  constructor(private readonly provider: DiscoveryProvider) {}

  async getSources(
    address: EthereumAddress,
    implementations?: EthereumAddress[],
  ): Promise<ContractSources> {
    const addresses = [address, ...(implementations ?? [])]
    const metadata = await Promise.all(
      addresses.map((x) => this.provider.getMetadata(x)),
    )

    const name = getLegacyDerivedName(metadata.map((x) => x.name))
    const abi = deduplicateAbi(metadata.flatMap((x) => x.abi))

    const abis: Record<string, string[]> = {}
    const files: Record<string, string>[] = []
    for (const [address, item] of zip(addresses, metadata)) {
      if (!address || !item) {
        continue
      }
      if (item.abi.length !== 0) {
        abis[address.toString()] = item.abi
      }
      files.push(processSources(address, item))
    }

    const isVerified = metadata.every((x) => x.isVerified)
    const isOnlyOneImplementation = implementations?.length === 1
    const isMoreThanOneImplementation = (implementations?.length ?? 0) > 1
    const sourceAddress = isOnlyOneImplementation
      ? implementations[0] ?? address
      : address

    const remappings: string[] = !isMoreThanOneImplementation
      ? getRemappings(await this.provider.getMetadata(sourceAddress))
      : []

    return { name, isVerified, abi, abis, files, remappings }
  }

  getRelevantAbi(
    abis: Record<string, string[]>,
    address: EthereumAddress,
    implementations?: EthereumAddress[],
    ignoreInWatchMode?: string[],
  ): string[] {
    const addresses = [address, ...(implementations ?? [])]
    const relevantAbis = addresses.flatMap((add) => {
      const abiEntry = Object.entries(abis).find(
        ([key]) => key === add.toString(),
      )
      return abiEntry ? abiEntry[1] : []
    })

    const abi = deduplicateAbi(relevantAbis)
    const relevantAbi = skipIgnoredFunctions(abi, ignoreInWatchMode)

    return relevantAbi
  }
}
