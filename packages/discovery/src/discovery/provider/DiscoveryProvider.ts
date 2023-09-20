import { providers } from 'ethers'

import { Bytes } from '../../utils/Bytes'
import { EthereumAddress } from '../../utils/EthereumAddress'
import { EtherscanLikeClient } from '../../utils/EtherscanLikeClient'
import { Hash256 } from '../../utils/Hash256'
import { jsonToHumanReadableAbi } from './jsonToHumanReadableAbi'
import { UnixTime } from '../../utils/UnixTime'
import { assert } from '@l2beat/backend-tools'

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

  async getLogs(
    address: EthereumAddress,
    topics: (string | string[])[],
    fromBlock: number,
    toBlock: number,
  ): Promise<providers.Log[]> {
    return this.provider.getLogs({
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

  async getFirstTxTimestamp(address: EthereumAddress) {
      return this.etherscanLikeClient.getFirstTxTimestamp(address)
  }

  async getDeploymentTimestamp(address: EthereumAddress) {
      const txHash = await this.getContractDeploymentTx(address)
      const tx = await this.provider.getTransaction(txHash.toString())
      assert(tx.blockNumber, 'Transaction returned without a block number.')
      const block = await this.provider.getBlock(tx.blockNumber)
      return new UnixTime(block.timestamp)
  }

  async getBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber()
  }
}
