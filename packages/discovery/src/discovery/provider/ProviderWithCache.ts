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
import { RateLimitedProvider } from './RateLimitedProvider'

const toJSON = <T>(x: T): string => JSON.stringify(x)
const fromJSON = <T>(x: string): T => JSON.parse(x) as T

export interface CacheIdentity {
  /**
   * Key constructed from the parameters of the call
   */
  key: string

  /**
   * Block number up to which the cache is valid
   * If not provided, the cache is valid for all blocks
   */
  blockNumber?: number
}

export interface DiscoveryCache {
  set(identity: CacheIdentity, value: string): Promise<void>
  get(identity: CacheIdentity): Promise<string | undefined>
}

export class ProviderWithCache extends DiscoveryProvider {
  constructor(
    provider: providers.Provider | RateLimitedProvider,
    etherscanLikeClient: EtherscanLikeClient,
    logger: DiscoveryLogger,
    private readonly chainId: ChainId,
    private readonly cache: DiscoveryCache,
    getLogsMaxRange?: number,
  ) {
    super(provider, etherscanLikeClient, logger, getLogsMaxRange)
  }

  private async cacheOrFetch<R>(
    identity: CacheIdentity,
    fetch: () => Promise<R>,
    toCache: (value: R) => string,
    fromCache: (value: string) => R,
  ): Promise<R> {
    const known = await this.cache.get(identity)
    if (known !== undefined) {
      return fromCache(known)
    }

    const result = await fetch()
    await this.cache.set(identity, toCache(result))

    return result
  }

  buildIdentity({
    invocation,
    blockNumber,
    params,
  }: {
    invocation: string
    blockNumber?: number
    params: { toString: () => string }[]
  }): CacheIdentity {
    const result = [
      this.chainId.toString(),
      invocation,
      ...params.map((p) => p.toString()),
    ]
    return {
      key: result.join('.'),
      blockNumber,
    }
  }

  override async call(
    address: EthereumAddress,
    data: Bytes,
    blockNumber: number,
  ): Promise<Bytes> {
    const identity = this.buildIdentity({
      invocation: 'call',
      blockNumber,
      params: [blockNumber, address, data],
    })

    const result = await this.cacheOrFetch(
      identity,
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
    const identity = this.buildIdentity({
      invocation: 'getStorage',
      blockNumber,
      params: [blockNumber, address, slot],
    })

    return this.cacheOrFetch(
      identity,
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

    /**
     * Passing `toBlock` as a point-in-time reference, so that whenever you are up to the invalidation
     * you will include whole range of blocks.
     *
     * @example
     *
     * ```ts
     * const invalidateAfterBlock = 1000
     *
     * const fromBlock = 500
     * const toBlock = 1500
     *
     * await invalidateAfter(invalidateAfterBlock) // catches 1500 and thus whole range
     * ```
     */
    const identity = this.buildIdentity({
      invocation: 'getLogsBatch',
      blockNumber: toBlock,
      params: [address, fromBlock, toBlock, topicsHash],
    })

    return this.cacheOrFetch(
      identity,
      () => super.getLogsBatch(address, topics, fromBlock, toBlock),
      toJSON,
      fromJSON,
    )
  }

  override async getCode(
    address: EthereumAddress,
    blockNumber: number,
  ): Promise<Bytes> {
    // Ignoring blockNumber here, assuming that code will not change
    const identity = this.buildIdentity({
      invocation: 'getCode',
      blockNumber,
      params: [address],
    })

    return this.cacheOrFetch(
      identity,
      () => super.getCode(address, blockNumber),
      (result) => result.toString(),
      (cached) => Bytes.fromHex(cached),
    )
  }

  override async getTransaction(
    hash: Hash256,
  ): Promise<providers.TransactionResponse> {
    const identity = this.buildIdentity({
      invocation: 'getTransaction',
      params: [hash],
    })

    return this.cacheOrFetch(
      identity,
      () => super.getTransaction(hash),
      toJSON,
      fromJSON,
    )
  }

  override async getBlock(blockNumber: number): Promise<providers.Block> {
    const identity = this.buildIdentity({
      invocation: 'getBlock',
      blockNumber,
      params: [blockNumber],
    })

    return this.cacheOrFetch(
      identity,
      () => super.getBlock(blockNumber),
      toJSON,
      fromJSON,
    )
  }

  override async getMetadata(
    address: EthereumAddress,
  ): Promise<ContractMetadata> {
    const key = this.buildIdentity({
      invocation: 'getMetadata',
      params: [address],
    })

    return this.cacheOrFetch(
      key,
      () => super.getMetadata(address),
      toJSON,
      fromJSON,
    )
  }

  override async getContractDeploymentTx(
    address: EthereumAddress,
  ): Promise<Hash256 | undefined> {
    const identity = this.buildIdentity({
      invocation: 'getContractDeploymentTx',
      params: [address],
    })

    // Special cache handling is necessary because
    // we support cases where getContractDeploymentTx API
    // is not available.
    const cached = await this.cache.get(identity)
    if (cached !== undefined) {
      return fromJSON(cached)
    }

    const result = await super.getContractDeploymentTx(address)
    // Don't cache "undefined"
    if (result !== undefined) {
      await this.cache.set(identity, toJSON(result))
    }
    return result
  }
}
