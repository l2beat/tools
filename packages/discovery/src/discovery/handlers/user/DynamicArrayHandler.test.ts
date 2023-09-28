import { expect, mockFn, mockObject } from 'earl'

import { Bytes } from '../../../utils/Bytes'
import { EthereumAddress } from '../../../utils/EthereumAddress'
import { DiscoveryLogger } from '../../DiscoveryLogger'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { DynamicArrayHandler } from './DynamicArrayHandler'

describe(DynamicArrayHandler.name, () => {
  const BLOCK_NUMBER = 1234

  describe('integration', () => {
    it('can return non-empty address array', async () => {
      const address = EthereumAddress.random()
      const provider = mockObject<DiscoveryProvider>({
        getStorage: mockFn()
          .executesOnce((passedAddress, slot) => {
            expect(passedAddress).toEqual(address)
            expect(slot).toEqual(85n)
            return Bytes.fromHex(
              '0x0000000000000000000000000000000000000000000000000000000000000002',
            )
          })
          .executesOnce((passedAddress, slot) => {
            expect(passedAddress).toEqual(address)
            expect(slot).toEqual(
              BigInt(
                '0x71beda120aafdd3bb922b360a066d10b7ce81d7ac2ad9874daac46e2282f6b45',
              ),
            )
            return Bytes.fromHex(
              '0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            )
          })
          .executesOnce((passedAddress, slot) => {
            expect(passedAddress).toEqual(address)
            expect(slot).toEqual(
              BigInt(
                '0x71beda120aafdd3bb922b360a066d10b7ce81d7ac2ad9874daac46e2282f6b46',
              ),
            )
            return Bytes.fromHex(
              '0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            )
          }),
      })

      const handler = new DynamicArrayHandler(
        'someName',
        {
          type: 'dynamicArray',
          slot: 85,
        },
        DiscoveryLogger.SILENT,
      )
      expect(handler.field).toEqual('someName')

      const result = await handler.execute(provider, address, BLOCK_NUMBER, {})
      expect(result).toEqual({
        field: 'someName',
        value: [
          '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa',
          '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        ],
        ignoreRelative: undefined,
      })
    })

    it('does nothing on empty address array', async () => {
      const address = EthereumAddress.random()
      const provider = mockObject<DiscoveryProvider>({
        getStorage: mockFn().executesOnce((passedAddress, slot) => {
          expect(passedAddress).toEqual(address)
          expect(slot).toEqual(85n)
          return Bytes.fromHex(
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          )
        }),
      })

      const handler = new DynamicArrayHandler(
        'someName',
        {
          type: 'dynamicArray',
          slot: 85,
        },
        DiscoveryLogger.SILENT,
      )
      expect(handler.field).toEqual('someName')

      const result = await handler.execute(provider, address, BLOCK_NUMBER, {})
      expect(result).toEqual({
        field: 'someName',
        value: [],
        ignoreRelative: undefined,
      })
    })
  })

  describe('dependencies', () => {
    it('detects no dependencies for a simple definition', () => {
      const handler = new DynamicArrayHandler(
        'someName',
        {
          type: 'dynamicArray',
          slot: 85,
        },
        DiscoveryLogger.SILENT,
      )

      expect(handler.dependencies).toEqual([])
    })

    it('detects dependency from the slot field', () => {
      const handler = new DynamicArrayHandler(
        'someName',
        {
          type: 'dynamicArray',
          slot: '{{ foo }}',
        },
        DiscoveryLogger.SILENT,
      )

      expect(handler.dependencies).toEqual(['foo'])
    })
  })

  it('handles provider errors', async () => {
    const handler = new DynamicArrayHandler(
      'someName',
      {
        type: 'dynamicArray',
        slot: 85,
      },
      DiscoveryLogger.SILENT,
    )

    const provider = mockObject<DiscoveryProvider>({
      async getStorage() {
        throw new Error('foo bar')
      },
    })
    const address = EthereumAddress.random()
    const result = await handler.execute(provider, address, BLOCK_NUMBER, {})
    expect(result).toEqual({
      field: 'someName',
      error: 'foo bar',
    })
  })
})
