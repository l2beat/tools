import { assert } from '@l2beat/backend-tools'
import { providers } from 'ethers'

import { Bytes } from '../../utils/Bytes'
import { EthereumAddress } from '../../utils/EthereumAddress'
import { EtherscanLikeClient } from '../../utils/EtherscanLikeClient'
import { Hash256 } from '../../utils/Hash256'
import { UnixTime } from '../../utils/UnixTime'
import { DiscoveryLogger } from '../DiscoveryLogger'
import { jsonToHumanReadableAbi } from './jsonToHumanReadableAbi'

export interface ContractMetadata {
  name: string
  isVerified: boolean
  abi: string[]
  source: string
}

/**
 * This class is meant as a wrapper for all interactions with the blockchain
 * and Etherscan for the purposes of discovery.
 *
 * The ultimate goal is for it to automatically handle batching, rate limiting,
 * error parsing and more low level stuff, so that the rest of the code can
 * remain simple and not worry about things like 429 Too Many Requests.
 *
 * It also has a set block number that will be kept constant.
 */
export class DiscoveryProvider {
  constructor(
    private readonly provider: providers.Provider,
    private readonly etherscanLikeClient: EtherscanLikeClient,
    private readonly logger: DiscoveryLogger,
    private readonly maxGetLogsRange?: number,
  ) {}

  async call(
    address: EthereumAddress,
    data: Bytes,
    blockNumber: number,
  ): Promise<Bytes> {
    const result = await this.provider.call(
      { to: address.toString(), data: data.toString() },
      blockNumber,
    )
    return Bytes.fromHex(result)
  }

  async getStorage(
    address: EthereumAddress,
    slot: number | bigint | Bytes,
    blockNumber: number,
  ): Promise<Bytes> {
    const result = await this.provider.getStorageAt(
      address.toString(),
      slot instanceof Bytes ? slot.toString() : slot,
      blockNumber,
    )
    return Bytes.fromHex(result)
  }

  public async getLogs(
    address: EthereumAddress,
    topics: (string | string[])[],
    fromBlock: number,
    toBlock: number,
  ): Promise<providers.Log[]> {
    if (fromBlock > toBlock) {
      throw new Error(
        `fromBlock (${fromBlock}) can't be bigger than toBlock (${toBlock})`,
      )
    }

    if (this.maxGetLogsRange === undefined) {
      return await this.getLogsBatch(address, topics, fromBlock, toBlock)
    }

    // To support efficient caching, we divide the requested blocks range into
    // sequential boundaries of `maxRange` size, e.g [0,10k-1], [10k, 20k-1], ...
    // Otherwise ranges would depend on `fromBlock` and even small change to it
    // would make the previous cache useless.

    // Let's start with the deployment block number if it's higher than fromBlock
    const { blockNumber: deploymentBlockNumber } =
      await this.getDeploymentInfo(address)

    const maxRange = this.maxGetLogsRange
    const allLogs: providers.Log[][] = []

    let curBoundaryStart
    let curBoundaryEnd
    let start = Math.max(fromBlock, deploymentBlockNumber)
    let end
    do {
      curBoundaryStart = Math.floor(start / maxRange) * maxRange
      curBoundaryEnd = curBoundaryStart + maxRange - 1 // getLogs 'to' is inclusive!
      end = Math.min(curBoundaryEnd, toBlock)
      const logs = await this.getLogsBatch(address, topics, start, end)
      allLogs.push(logs)
      start = end + 1
    } while (start <= toBlock)

    return allLogs.flat()
  }

  public async getLogsBatch(
    address: EthereumAddress,
    topics: (string | string[])[],
    fromBlock: number,
    toBlock: number,
  ): Promise<providers.Log[]> {
    this.logger.logFetchingEvents(fromBlock, toBlock)
    return await this.provider.getLogs({
      address: address.toString(),
      fromBlock,
      toBlock,
      topics,
    })
  }

  async getTransaction(
    transactionHash: Hash256,
  ): Promise<providers.TransactionResponse> {
    return this.provider.getTransaction(transactionHash.toString())
  }

  async getCode(address: EthereumAddress, blockNumber: number): Promise<Bytes> {
    const result = await this.provider.getCode(address.toString(), blockNumber)
    return Bytes.fromHex(result)
  }

  async getMetadata(address: EthereumAddress): Promise<ContractMetadata> {
    const result = await this.etherscanLikeClient.getContractSource(address)
    const isVerified = result.ABI !== 'Contract source code not verified'

    return {
      name: result.ContractName.trim(),
      isVerified,
      abi: isVerified ? jsonToHumanReadableAbi(result.ABI) : [],
      source: result.SourceCode,
    }
  }

  async getConstructorArgs(address: EthereumAddress): Promise<string> {
    const result = await this.etherscanLikeClient.getContractSource(address)
    return result.ConstructorArguments
  }

  async getContractDeploymentTx(address: EthereumAddress): Promise<Hash256> {
    return this.etherscanLikeClient.getContractDeploymentTx(address)
  }

  async getDeployer(address: EthereumAddress): Promise<EthereumAddress> {
    const txHash = await this.getContractDeploymentTx(address)
    const tx = await this.getTransaction(txHash)

    return EthereumAddress(tx.from)
  }

  async getFirstTxTimestamp(address: EthereumAddress): Promise<UnixTime> {
    return this.etherscanLikeClient.getFirstTxTimestamp(address)
  }

  async getDeploymentInfo(address: EthereumAddress): Promise<{
    blockNumber: number
    timestamp: UnixTime
  }> {
    const txHash = await this.getContractDeploymentTx(address)
    const tx = await this.provider.getTransaction(txHash.toString())
    assert(tx.blockNumber, 'Transaction returned without a block number.')
    const block = await this.provider.getBlock(tx.blockNumber)
    return {
      blockNumber: tx.blockNumber,
      timestamp: new UnixTime(block.timestamp),
    }
  }

  async getBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber()
  }
}
