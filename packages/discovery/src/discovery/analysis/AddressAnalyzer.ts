import { assert } from '@l2beat/backend-tools'
import {
  ContractParameters,
  ContractValue,
  UpgradeabilityParameters,
} from '@l2beat/discovery-types'
import { isEqual } from 'lodash'

import { Bytes } from '../../utils/Bytes'
import { EthereumAddress } from '../../utils/EthereumAddress'
import { UnixTime } from '../../utils/UnixTime'
import { ContractOverrides } from '../config/DiscoveryOverrides'
import { DiscoveryLogger } from '../DiscoveryLogger'
import { HandlerExecutor } from '../handlers/HandlerExecutor'
import { DiscoveryProvider } from '../provider/DiscoveryProvider'
import { ProxyDetector } from '../proxies/ProxyDetector'
import { SourceCodeService } from '../source/SourceCodeService'
import { getRelatives } from './getRelatives'

export type Analysis = AnalyzedContract | AnalyzedEOA

export interface AnalyzedContract {
  type: 'Contract'
  address: EthereumAddress
  name: string
  deploymentTimestamp?: UnixTime
  deploymentBlockNumber?: number
  derivedName: string | undefined
  isVerified: boolean
  upgradeability: UpgradeabilityParameters
  implementations: EthereumAddress[]
  values: Record<string, ContractValue>
  errors: Record<string, string>
  abis: Record<string, string[]>
  sources: Record<string, string>[]
}

export interface AnalyzedEOA {
  type: 'EOA'
  address: EthereumAddress
}

export class AddressAnalyzer {
  constructor(
    private readonly provider: DiscoveryProvider,
    private readonly proxyDetector: ProxyDetector,
    private readonly sourceCodeService: SourceCodeService,
    private readonly handlerExecutor: HandlerExecutor,
    private readonly logger: DiscoveryLogger,
  ) {}

  async analyze(
    address: EthereumAddress,
    overrides: ContractOverrides | undefined,
    blockNumber: number,
  ): Promise<{ analysis: Analysis; relatives: EthereumAddress[] }> {
    const code = await this.getCode(address, blockNumber)
    if (code.length === 0) {
      this.logger.logEoa()
      return { analysis: { type: 'EOA', address }, relatives: [] }
    }

    const deployment = await this.provider.getDeploymentInfo(address)

    const proxy = await this.proxyDetector.detectProxy(
      address,
      blockNumber,
      overrides?.proxyType,
    )

    const sources = await this.sourceCodeService.getSources(
      address,
      proxy?.implementations,
    )

    this.logger.logName(sources.name)

    const { results, values, errors } = await this.handlerExecutor.execute(
      address,
      sources.abi,
      overrides,
      blockNumber,
    )

    return {
      analysis: {
        type: 'Contract',
        name: overrides?.name ?? sources.name,
        derivedName: overrides?.name !== undefined ? sources.name : undefined,
        isVerified: sources.isVerified,
        address,
        deploymentTimestamp: deployment?.timestamp,
        deploymentBlockNumber: deployment?.blockNumber,
        upgradeability: proxy?.upgradeability ?? { type: 'immutable' },
        implementations: proxy?.implementations ?? [],
        values: values ?? {},
        errors: errors ?? {},
        abis: sources.abis,
        sources: sources.files,
      },
      relatives: getRelatives(
        results,
        overrides?.ignoreRelatives,
        proxy?.relatives,
        proxy?.implementations,
      ),
    }
  }

  async watchContract(
    contract: ContractParameters,
    overrides: ContractOverrides,
    blockNumber: number,
    abis: Record<string, string[]>,
  ): Promise<boolean> {
    if (contract.unverified) {
      // Check if the contract is verified now
      const code = await this.getCode(contract.address, blockNumber)
      return code.length > 0
    }

    const abi = this.sourceCodeService.zipAbis(
      abis,
      contract.address,
      contract.implementations,
    )

    const { values, errors } = await this.handlerExecutor.execute(
      contract.address,
      abi,
      overrides,
      blockNumber,
    )

    assert(
      errors === undefined || Object.keys(errors).length === 0,
      'Errors during watch mode',
    )

    if (!isEqual(values, contract.values)) {
      return true
    }

    return false
  }

  async watchEoa(
    address: EthereumAddress,
    blockNumber: number,
  ): Promise<boolean> {
    const code = await this.getCode(address, blockNumber)
    return code.length > 0
  }

  async getCode(address: EthereumAddress, blockNumber: number): Promise<Bytes> {
    return await this.provider.getCode(address, blockNumber)
  }
}
