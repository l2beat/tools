import { expect, mockObject } from 'earl'
import { providers, utils } from 'ethers'

import { Bytes } from '../../../utils/Bytes'
import { EthereumAddress } from '../../../utils/EthereumAddress'
import { Hash256 } from '../../../utils/Hash256'
import { DiscoveryLogger } from '../../DiscoveryLogger'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { ArbitrumSequencerVersionHandler } from './ArbitrumSequencerVersionHandler'

describe(ArbitrumSequencerVersionHandler.name, () => {
  const BLOCK_NUMBER = 999

  const addSequencerBatchV1 =
    'addSequencerL2BatchFromOrigin(uint256 sequenceNumber, bytes calldata data, uint256 afterDelayedMessagesRead, address gasRefunder)'
  const addSequencerBatchV2 =
    'addSequencerL2BatchFromOrigin(uint256 sequenceNumber, bytes calldata data, uint256 afterDelayedMessagesRead, address gasRefunder, uint256 prevMessageCount, uint256 newMessageCount)'

  const abi = new utils.Interface([
    'event SequencerBatchDelivered(uint256 indexed batchSequenceNumber, bytes32 indexed beforeAcc, bytes32 indexed afterAcc, bytes32 delayedAcc, uint256 afterDelayedMessagesRead, tuple(uint64, uint64, uint64, uint64) timeBounds, uint8 dataLocation)',
    `function ${addSequencerBatchV1}`,
    `function ${addSequencerBatchV2}`,
  ])

  function SequencerBatchDelivered(passesFilter: boolean): providers.Log {
    const result = abi.encodeEventLog(abi.getEvent('SequencerBatchDelivered'), [
      1234,
      Hash256.random().toString(),
      Hash256.random().toString(),
      Hash256.random().toString(),
      1234,
      [1234, 1234, 1234, 1234],
      passesFilter ? 0 : 1,
    ]) as providers.Log

    result.transactionHash = Hash256.random().toString()
    return result
  }

  const testVersions = [0, 15, 27, 44, 57, 212, 92, 41, 217, 255]
  for (const version of testVersions) {
    it(`fetches last event and decodes the values correctly for newer function [version=${version}]`, async () => {
      const address = EthereumAddress.random()
      const provider = mockObject<DiscoveryProvider>({
        async getLogs(providedAddress, topics, fromBlock, toBlock) {
          expect(providedAddress).toEqual(address)
          expect(topics).toEqual([
            [abi.getEventTopic('SequencerBatchDelivered')],
          ])
          expect(fromBlock).toEqual(0)
          expect(toBlock).toEqual(BLOCK_NUMBER)
          return [
            SequencerBatchDelivered(false),
            SequencerBatchDelivered(true),
            SequencerBatchDelivered(false),
          ]
        },
        async getTransaction() {
          const functionInputCalldata = Bytes.fromHex(version.toString(16))
            .concat(Bytes.randomOfLength(128))
            .toString()
          return {
            data: abi.encodeFunctionData(addSequencerBatchV2, [
              1234,
              functionInputCalldata,
              1234,
              EthereumAddress.random().toString(),
              1234,
              1234,
            ]),
          } as providers.TransactionResponse
        },
      })

      const handler = new ArbitrumSequencerVersionHandler(
        'someName',
        { type: 'arbitrumSequencerVersion' },
        DiscoveryLogger.SILENT,
      )

      const result = await handler.execute(provider, address, BLOCK_NUMBER)
      expect(result).toEqual({
        field: 'someName',
        value: Bytes.fromHex(version.toString(16)).toString(),
      })
    })

    it(`fetches last event and decodes the values correctly for deprecated function [version=${version}]`, async () => {
      const address = EthereumAddress.random()
      const provider = mockObject<DiscoveryProvider>({
        async getLogs(providedAddress, topics, fromBlock, toBlock) {
          expect(providedAddress).toEqual(address)
          expect(topics).toEqual([
            [abi.getEventTopic('SequencerBatchDelivered')],
          ])
          expect(fromBlock).toEqual(0)
          expect(toBlock).toEqual(BLOCK_NUMBER)
          return [SequencerBatchDelivered(true), SequencerBatchDelivered(false)]
        },
        async getTransaction() {
          const functionInputCalldata = Bytes.fromHex(version.toString(16))
            .concat(Bytes.randomOfLength(128))
            .toString()
          return {
            data: abi.encodeFunctionData(addSequencerBatchV1, [
              1234,
              functionInputCalldata,
              1234,
              EthereumAddress.random().toString(),
            ]),
          } as providers.TransactionResponse
        },
      })

      const handler = new ArbitrumSequencerVersionHandler(
        'someName',
        { type: 'arbitrumSequencerVersion' },
        DiscoveryLogger.SILENT,
      )

      const result = await handler.execute(provider, address, BLOCK_NUMBER)
      expect(result).toEqual({
        field: 'someName',
        value: Bytes.fromHex(version.toString(16)).toString(),
      })
    })
  }

  it('throws when no events are found', async () => {
    const address = EthereumAddress.random()
    const provider = mockObject<DiscoveryProvider>({
      async getLogs(providedAddress, topics, fromBlock, toBlock) {
        expect(providedAddress).toEqual(address)
        expect(topics).toEqual([[abi.getEventTopic('SequencerBatchDelivered')]])
        expect(fromBlock).toEqual(0)
        expect(toBlock).toEqual(BLOCK_NUMBER)
        return []
      },
    })

    const handler = new ArbitrumSequencerVersionHandler(
      'someName',
      { type: 'arbitrumSequencerVersion' },
      DiscoveryLogger.SILENT,
    )

    await expect(
      handler.execute(provider, address, BLOCK_NUMBER),
    ).toBeRejectedWith('No event found')
  })
})
