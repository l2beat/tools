import { ContractValue } from '@l2beat/discovery-types'

import { EthereumAddress } from '../../utils/EthereumAddress'
import { DiscoveryLogger } from '../DiscoveryLogger'
import { DiscoveryProvider } from '../provider/DiscoveryProvider'
import {
  MulticallRequest,
  MulticallResponse,
} from '../provider/multicall/types'

export interface HandlerResult {
  field: string
  value?: ContractValue
  error?: string
  ignoreRelative?: boolean
}

export interface ClassicHandler {
  field: string
  dependencies: string[]
  logger?: DiscoveryLogger
  execute(
    provider: DiscoveryProvider,
    address: EthereumAddress,
    blockNumber: number,
    previousResults: Record<string, HandlerResult | undefined>,
  ): Promise<HandlerResult>
}

export interface MulticallableHandler extends ClassicHandler {
  multicallable: true
  encode(
    address: EthereumAddress,
    previousResults: Record<string, HandlerResult | undefined>,
  ): MulticallRequest[]
  decode: (result: MulticallResponse[]) => HandlerResult
}

export type Handler = MulticallableHandler | ClassicHandler
