import { expect, mockFn, mockObject } from 'earl'
import { ethers } from 'ethers'

import { EthereumAddress } from '../../../utils/EthereumAddress'
import { DiscoveryLogger } from '../../DiscoveryLogger'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import {
  ConstructorArgsHandler,
  serializeResult,
} from './ConstructorArgsHandler'

describe(ConstructorArgsHandler.name, () => {
  describe(ConstructorArgsHandler.prototype.execute.name, () => {
    it('correctly extract constructor arguments', async () => {
      const sampleAbi = [
        'constructor(string name, string symbol, uint8 decimals, bytes32 someBytes, uint256 someNumber)',
      ]

      /**
       * You can achive the same result using:
       * @example
       * ```ts
       * const [ctorFragment] = new ethers.utils.Interface(sampleAbi).fragments
       *
       * const encodedData = ethers.utils.defaultAbiCoder.encode(
       *   ctorFragment!.inputs,
       *   [
       *     'Pi Day N00b Token',
       *     'PIE',
       *     18,
       *     '<your_bytes_bignumber>',
       *     '0',
       *   ]
       *)
       * ```
       */
      const sampleCtorEncodedArgs =
        '00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000012dc03b7993bad736ad595eb9e3ba51877ac17ecc31d2355f8f270125b9427ece700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011506920446179204e30306220546f6b656e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000035049450000000000000000000000000000000000000000000000000000000000'

      const handler = new ConstructorArgsHandler(
        'constructorArgs',
        sampleAbi,
        DiscoveryLogger.SILENT,
      )

      const contractAddress = EthereumAddress.random()

      const provider = mockObject<DiscoveryProvider>({
        getConstructorArgs: mockFn<
          DiscoveryProvider['getConstructorArgs']
        >().resolvesTo(sampleCtorEncodedArgs),
      })

      const response = await handler.execute(provider, contractAddress)

      expect(response).toEqual({
        field: 'constructorArgs',
        value: [
          'Pi Day N00b Token',
          'PIE',
          18,
          '0xdc03b7993bad736ad595eb9e3ba51877ac17ecc31d2355f8f270125b9427ece7',
          '0',
        ],
      })
      expect(provider.getConstructorArgs).toHaveBeenOnlyCalledWith(
        contractAddress,
      )
    })
  })
})

describe('serializeResult', () => {
  it('should serialize a result', () => {
    const results: ethers.utils.Result = [
      ['0x696cC7615A50CF12d1d1B38bF18A5606e9708296'],
      ethers.BigNumber.from(3),
    ]

    const serialized = serializeResult(results)

    expect(serialized).toEqual([
      ['0x696cC7615A50CF12d1d1B38bF18A5606e9708296'],
      '3',
    ])
  })
})
