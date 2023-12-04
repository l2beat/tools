import { EthereumAddress } from '../EthereumAddress'
import { Hash256 } from '../Hash256'
import { UnixTime } from '../UnixTime'

export interface ContractSourceData {
  contractName: string
  sourceCode: string
  abi: string
  ctorArgs: string
  isVerified: boolean
}

export class ExplorerError extends Error {}

export interface ExplorerClient {
  getBlockNumberAtOrBefore(timestamp: UnixTime): Promise<number>
  getContractSource(address: EthereumAddress): Promise<ContractSourceData>
  getContractDeploymentTx(
    address: EthereumAddress,
  ): Promise<Hash256 | undefined>
  getFirstTxTimestamp(address: EthereumAddress): Promise<UnixTime>
}
