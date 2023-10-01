import { createHash } from 'crypto'
import { providers } from 'ethers'

import { Bytes } from '../../utils/Bytes'
import { ChainId } from '../../utils/ChainId'
import { EthereumAddress } from '../../utils/EthereumAddress'
import { EtherscanLikeClient } from '../../utils/EtherscanLikeClient'
import { Hash256 } from '../../utils/Hash256'
import { DiscoveryLogger } from '../DiscoveryLogger'
import { isRevert } from '../utils/isRevert'
import { ContractMetadata, DiscoveryProvider } from './DiscoveryProvider'
import { ProviderCache } from './ProviderCache'

const toJSON = <T>(x: T): string => JSON.stringify(x)
const fromJSON = <T>(x: string): T => JSON.parse(x) as T

export class ProviderWithCache extends DiscoveryProvider {
  private readonly cache: ProviderCache

  constructor(
    provider: providers.Provider,
    etherscanClient: EtherscanLikeClient,
    logger: DiscoveryLogger,
    chainId: ChainId,
    getLogsMaxRange?: number,
  ) {
    super(provider, etherscanClient, logger, getLogsMaxRange)
    this.cache = new ProviderCache(chainId)
  }

  async init(): Promise<void> {
    await this.cache.init()
  }

  private async cacheOrFetch<R>(
    filename: string,
    key: string,
    fetch: () => Promise<R>,
    toCache: (value: R) => string,
    fromCache: (value: string) => R,
  ): Promise<R> {
    const known = await this.cache.get(filename, key)
    if (known !== undefined) {
      return fromCache(known)
    }

    const result = await fetch()
    await this.cache.set(filename, key, toCache(result))

    return result
  }

  override async call(
    address: EthereumAddress,
    data: Bytes,
    blockNumber: number,
  ): Promise<Bytes> {
    const result = await this.cacheOrFetch(
      `blocks/${blockNumber}`,
      `call.${address.toString()}.${data.toString()}`,
      async () => {
        try {
          return {
            value: (await super.call(address, data, blockNumber)).toString(),
          }
        } catch (e) {
          if (isRevert(e)) {
            return { error: 'revert' }
          } else {
            throw e
          }
        }
      },
      toJSON,
      fromJSON,
    )
    if (result.value !== undefined) {
      return Bytes.fromHex(result.value)
    } else {
      throw new Error(result.error)
    }
  }

  override async getStorage(
    address: EthereumAddress,
    slot: number | Bytes,
    blockNumber: number,
  ): Promise<Bytes> {
    return this.cacheOrFetch(
      `blocks/${blockNumber}`,
      `getStorage.${address.toString()}.${slot.toString()}`,
      () => super.getStorage(address, slot, blockNumber),
      (result) => result.toString(),
      (cached) => Bytes.fromHex(cached),
    )
  }

  override async getLogsBatch(
    address: EthereumAddress,
    topics: string[][],
    fromBlock: number,
    toBlock: number,
  ): Promise<providers.Log[]> {
    const topicsHash: string = createHash('sha256')
      .update(JSON.stringify(topics))
      .digest('hex')

    return this.cacheOrFetch(
      `logs/${address.toString()}`,
      `getLogs.${fromBlock}.${toBlock}.${topicsHash}`,
      () => super.getLogsBatch(address, topics, fromBlock, toBlock),
      toJSON,
      fromJSON,
    )
  }

  override async getCode(
    address: EthereumAddress,
    blockNumber: number,
  ): Promise<Bytes> {
    return this.cacheOrFetch(
      // Ignoring blockNumber here, assuming that code will not change
      `addresses/${address.toString()}}`,
      `getCode.${address.toString()}`,
      () => super.getCode(address, blockNumber),
      (result) => result.toString(),
      (cached) => Bytes.fromHex(cached),
    )
  }

  override async getTransaction(
    hash: Hash256,
  ): Promise<providers.TransactionResponse> {
    return this.cacheOrFetch(
      `transactions/${hash.toString()}}`,
      `getTransaction`,
      () => super.getTransaction(hash),
      toJSON,
      fromJSON,
    )
  }

  override async getBlock(blockNumber: number): Promise<providers.Block> {
    return this.cacheOrFetch(
      `blocks/${blockNumber}`,
      `getBlock`,
      () => super.getBlock(blockNumber),
      toJSON,
      fromJSON,
    )
  }

  override async getMetadata(
    address: EthereumAddress,
  ): Promise<ContractMetadata> {
    return this.cacheOrFetch(
      `addresses/${address.toString()}}`,
      `getMetadata`,
      () => super.getMetadata(address),
      toJSON,
      fromJSON,
    )
  }

  override async getContractDeploymentTx(
    address: EthereumAddress,
  ): Promise<Hash256> {
    return this.cacheOrFetch(
      `addresses/${address.toString()}}`,
      `getContractDeploymentTx`,
      () => super.getContractDeploymentTx(address),
      toJSON,
      fromJSON,
    )
  }
}
