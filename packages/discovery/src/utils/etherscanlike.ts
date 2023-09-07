import { assert, Logger, RateLimiter } from '@l2beat/backend-tools'
import { z } from 'zod'

import { stringAs, stringAsInt } from './branded'
import { EthereumAddress } from './EthereumAddress'
import { getErrorMessage } from './getErrorMessage'
import { Hash256 } from './Hash256'
import { HttpClient } from './httpclient'
import { EtherscanResponse, parseEtherscanResponse } from './models'
import { UnixTime } from './UnixTime'

class EtherscanError extends Error {}

export class EtherscanLikeClient {
  private readonly rateLimiter = new RateLimiter({
    callsPerMinute: 150,
  })
  private readonly timeoutMs = 20_000

  constructor(
    private readonly httpClient: HttpClient,
    private readonly url: string,
    private readonly apiKey: string,
    readonly minTimestamp: UnixTime,
    private readonly logger = Logger.SILENT,
  ) {
    this.call = this.rateLimiter.wrap(this.call.bind(this))
  }

  /**
   * Creates a client that can be used for discovery so does not need a minTimestamp.
   */
  static createForDiscovery(
    httpClient: HttpClient,
    url: string,
    apiKey: string,
  ): EtherscanLikeClient {
    return new EtherscanLikeClient(httpClient, url, apiKey, new UnixTime(0))
  }

  // Etherscan API is not stable enough to trust it to return "closest" block.
  // There is a case when there is not enough activity on a given chain
  // so that blocks come in a greater than 10 minutes intervals,
  // e.g block 0 @ 22:45 and block 1 @ 23:15
  // if you query for 23:00 Etherscan API returns "No closes block found".
  //
  // To mitigate this, we need to go back in time by 10 minutes until we find a block
  async getBlockNumberAtOrBefore(timestamp: UnixTime): Promise<number> {
    let current = new UnixTime(timestamp.toNumber())

    while (current.gte(this.minTimestamp)) {
      try {
        const result = await this.call('block', 'getblocknobytime', {
          timestamp: current.toString(),
          closest: 'before',
        })

        return stringAsInt().parse(result)
      } catch (error) {
        if (typeof error !== 'object') {
          const errorString =
            typeof error === 'string' ? error : 'Unknown error type caught'
          throw new Error(errorString)
        }

        const errorObject = error as EtherscanError
        if (!errorObject.message.includes('No closest block found')) {
          throw new Error(errorObject.message)
        }

        current = current.add(-10, 'minutes')
      }
    }

    throw new Error('Could not fetch block number')
  }

  async getContractSource(address: EthereumAddress): Promise<ContractSource> {
    const response = await this.call('contract', 'getsourcecode', {
      address: address.toString(),
    })

    const source = ContractSourceResult.parse(response)

    assert(source[0])

    return source[0]
  }

  async getContractDeploymentTx(address: EthereumAddress): Promise<Hash256> {
    const response = await this.call('contract', 'getcontractcreation', {
      contractaddresses: address.toString(),
    })

    const tx = ContractCreatorAndCreationTxHashResult.parse(response)[0]

    assert(tx?.txHash)

    return tx.txHash
  }

  async call(
    module: string,
    action: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const query = new URLSearchParams({
      module,
      action,
      ...params,
      apikey: this.apiKey,
    })
    const url = `${this.url}?${query.toString()}`

    const start = Date.now()
    const { httpResponse, error } = await this.httpClient
      .fetch(url, { timeout: this.timeoutMs })
      .then(
        (httpResponse) => ({ httpResponse, error: undefined }),
        (error: unknown) => ({ httpResponse: undefined, error }),
      )
    const timeMs = Date.now() - start

    if (!httpResponse) {
      const message = getErrorMessage(error)
      this.recordError(module, action, timeMs, message)
      throw error
    }

    const text = await httpResponse.text()
    const etherscanResponse = tryParseEtherscanResponse(text)

    if (!httpResponse.ok) {
      this.recordError(module, action, timeMs, text)
      throw new Error(
        `Server responded with non-2XX result: ${httpResponse.status} ${httpResponse.statusText}`,
      )
    }

    if (!etherscanResponse) {
      const message = `Invalid Etherscan response [${text}] for request [${url}].`
      this.recordError(module, action, timeMs, message)
      throw new TypeError(message)
    }

    if (etherscanResponse.message !== 'OK') {
      this.recordError(module, action, timeMs, etherscanResponse.result)
      throw new EtherscanError(etherscanResponse.result)
    }

    this.logger.debug({ type: 'success', timeMs, module, action })
    return etherscanResponse.result
  }

  private recordError(
    module: string,
    action: string,
    timeMs: number,
    message: string,
  ): void {
    this.logger.debug({ type: 'error', message, timeMs, module, action })
  }
}

function tryParseEtherscanResponse(
  text: string,
): EtherscanResponse | undefined {
  try {
    return parseEtherscanResponse(text)
  } catch {
    return undefined
  }
}

export type ContractSource = z.infer<typeof ContractSource>
export const ContractSource = z.object({
  SourceCode: z.string(),
  ABI: z.string(),
  ContractName: z.string(),
  CompilerVersion: z.string(),
  OptimizationUsed: z.string(),
  Runs: z.string(),
  ConstructorArguments: z.string(),
  EVMVersion: z.string(),
  Library: z.string(),
  LicenseType: z.string(),
  Proxy: z.string(),
  Implementation: z.string(),
  SwarmSource: z.string(),
})

export const ContractSourceResult = z.array(ContractSource).length(1)

export type ContractCreatorAndCreationTxHash = z.infer<
  typeof ContractCreatorAndCreationTxHash
>
export const ContractCreatorAndCreationTxHash = z.object({
  contractAddress: stringAs(EthereumAddress),
  contractCreator: stringAs(EthereumAddress),
  txHash: stringAs(Hash256),
})

export const ContractCreatorAndCreationTxHashResult = z
  .array(ContractCreatorAndCreationTxHash)
  .length(1)
