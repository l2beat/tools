import { ContractParameters } from '@l2beat/discovery-types'
import { expect, mockFn, mockObject } from 'earl'

import { Bytes } from '../../utils/Bytes'
import { EthereumAddress } from '../../utils/EthereumAddress'
import { UnixTime } from '../../utils/UnixTime'
import { ContractOverrides } from '../config/DiscoveryOverrides'
import { DiscoveryLogger } from '../DiscoveryLogger'
import { HandlerExecutor } from '../handlers/HandlerExecutor'
import { DiscoveryProvider } from '../provider/DiscoveryProvider'
import { ProxyDetector } from '../proxies/ProxyDetector'
import { ContractSources, SourceCodeService } from '../source/SourceCodeService'
import { AddressAnalyzer } from './AddressAnalyzer'

describe(AddressAnalyzer.name, () => {
  const BLOCK_NUMBER = 1234

  describe(AddressAnalyzer.prototype.analyze.name, () => {
    it('handles EOAs', async () => {
      const addressAnalyzer = new AddressAnalyzer(
        mockObject<DiscoveryProvider>({
          getCode: async () => Bytes.EMPTY,
        }),
        mockObject<ProxyDetector>(),
        mockObject<SourceCodeService>(),
        mockObject<HandlerExecutor>(),
        DiscoveryLogger.SILENT,
      )

      const address = EthereumAddress.random()
      const result = await addressAnalyzer.analyze(
        address,
        undefined,
        BLOCK_NUMBER,
      )

      expect(result).toEqual({
        analysis: { type: 'EOA', address },
        relatives: [],
      })
    })

    it('handles contracts', async () => {
      const address = EthereumAddress.random()
      const implementation = EthereumAddress.random()
      const admin = EthereumAddress.random()
      const owner = EthereumAddress.random()

      const sources: ContractSources = {
        name: 'Test',
        isVerified: true,
        abi: ['function foo()', 'function bar()'],
        abis: {
          [address.toString()]: ['function foo()'],
          [implementation.toString()]: ['function bar()'],
        },
        files: [
          { 'Foo.sol': 'contract Test { function foo() {} }' },
          { 'Bar.sol': 'contract Test { function bar() {} }' },
        ],
      }

      const addressAnalyzer = new AddressAnalyzer(
        mockObject<DiscoveryProvider>({
          getCode: async () => Bytes.fromHex('0x1234'),
          getDeploymentInfo: async () => ({
            timestamp: new UnixTime(1234),
            blockNumber: 9876,
          }),
        }),
        mockObject<ProxyDetector>({
          detectProxy: async () => ({
            upgradeability: {
              type: 'EIP1967 proxy',
              implementation,
              admin,
            },
            implementations: [implementation],
            relatives: [admin],
          }),
        }),
        mockObject<SourceCodeService>({
          getSources: async () => sources,
        }),
        mockObject<HandlerExecutor>({
          execute: async () => ({
            results: [{ field: 'owner', value: owner.toString() }],
            values: { owner: owner.toString() },
            errors: {},
          }),
        }),
        DiscoveryLogger.SILENT,
      )

      const result = await addressAnalyzer.analyze(
        address,
        undefined,
        BLOCK_NUMBER,
      )

      expect(result).toEqual({
        analysis: {
          type: 'Contract',
          address,
          name: 'Test',
          derivedName: undefined,
          isVerified: true,
          deploymentTimestamp: new UnixTime(1234),
          deploymentBlockNumber: 9876,
          upgradeability: { type: 'EIP1967 proxy', implementation, admin },
          implementations: [implementation],
          values: { owner: owner.toString() },
          errors: {},
          abis: sources.abis,
          sources: sources.files,
        },
        relatives: [owner, admin],
      })
    })

    it('handles unverified contracts', async () => {
      const address = EthereumAddress.random()
      const implementation = EthereumAddress.random()
      const admin = EthereumAddress.random()
      const owner = EthereumAddress.random()

      const sources: ContractSources = {
        name: 'Test',
        isVerified: false,
        abi: ['function foo()'],
        abis: {
          [address.toString()]: ['function foo()'],
        },
        files: [{ 'Foo.sol': 'contract Test { function foo() {} }' }, {}],
      }

      const addressAnalyzer = new AddressAnalyzer(
        mockObject<DiscoveryProvider>({
          getCode: async () => Bytes.fromHex('0x1234'),
          getDeploymentInfo: async () => ({
            timestamp: new UnixTime(1234),
            blockNumber: 9876,
          }),
        }),
        mockObject<ProxyDetector>({
          detectProxy: async () => ({
            upgradeability: {
              type: 'EIP1967 proxy',
              implementation,
              admin,
            },
            implementations: [implementation],
            relatives: [admin],
          }),
        }),
        mockObject<SourceCodeService>({
          getSources: async () => sources,
        }),
        mockObject<HandlerExecutor>({
          execute: async () => ({
            results: [{ field: 'owner', value: owner.toString() }],
            values: { owner: owner.toString() },
            errors: {},
          }),
        }),
        DiscoveryLogger.SILENT,
      )

      const result = await addressAnalyzer.analyze(
        address,
        undefined,
        BLOCK_NUMBER,
      )

      expect(result).toEqual({
        analysis: {
          type: 'Contract',
          name: 'Test',
          derivedName: undefined,
          address,
          isVerified: false,
          deploymentTimestamp: new UnixTime(1234),
          deploymentBlockNumber: 9876,
          upgradeability: { type: 'EIP1967 proxy', implementation, admin },
          implementations: [implementation],
          values: { owner: owner.toString() },
          errors: {},
          abis: sources.abis,
          sources: sources.files,
        },
        relatives: [owner, admin],
      })
    })

    it('handles contracts while omitting the sinceTimestamp', async () => {
      const address = EthereumAddress.random()
      const implementation = EthereumAddress.random()
      const admin = EthereumAddress.random()
      const owner = EthereumAddress.random()

      const sources: ContractSources = {
        name: 'Test',
        isVerified: true,
        abi: ['function foo()', 'function bar()'],
        abis: {
          [address.toString()]: ['function foo()'],
          [implementation.toString()]: ['function bar()'],
        },
        files: [
          { 'Foo.sol': 'contract Test { function foo() {} }' },
          { 'Bar.sol': 'contract Test { function bar() {} }' },
        ],
      }

      const addressAnalyzer = new AddressAnalyzer(
        mockObject<DiscoveryProvider>({
          getCode: async () => Bytes.fromHex('0x1234'),
          getDeploymentInfo: mockFn().resolvesTo(undefined),
        }),
        mockObject<ProxyDetector>({
          detectProxy: async () => ({
            upgradeability: {
              type: 'EIP1967 proxy',
              implementation,
              admin,
            },
            implementations: [implementation],
            relatives: [admin],
          }),
        }),
        mockObject<SourceCodeService>({
          getSources: async () => sources,
        }),
        mockObject<HandlerExecutor>({
          execute: async () => ({
            results: [{ field: 'owner', value: owner.toString() }],
            values: { owner: owner.toString() },
            errors: {},
          }),
        }),
        DiscoveryLogger.SILENT,
      )

      const result = await addressAnalyzer.analyze(
        address,
        undefined,
        BLOCK_NUMBER,
      )

      expect(result).toEqual({
        analysis: {
          type: 'Contract',
          address,
          name: 'Test',
          derivedName: undefined,
          deploymentBlockNumber: undefined,
          deploymentTimestamp: undefined,
          isVerified: true,
          upgradeability: { type: 'EIP1967 proxy', implementation, admin },
          implementations: [implementation],
          values: { owner: owner.toString() },
          errors: {},
          abis: sources.abis,
          sources: sources.files,
        },
        relatives: [owner, admin],
      })
    })
  })

  describe(AddressAnalyzer.prototype.watchContract.name, () => {
    it('handles immutable contracts', async () => {
      const address = EthereumAddress.random()
      const values = { foo: 'bar' }

      const addressAnalyzer = new AddressAnalyzer(
        mockObject<DiscoveryProvider>({
          getCode: async () => Bytes.fromHex('0x10'),
        }),
        mockObject<ProxyDetector>(),
        mockObject<SourceCodeService>({
          getRelevantAbi: (abis) => abis[0] ?? [],
        }),
        mockObject<HandlerExecutor>({
          execute: mockFn()
            .resolvesToOnce({
              results: [],
              values,
              errors: {},
            })
            .resolvesToOnce({
              results: [],
              // values change on the second run
              values: { foo: 'baz' },
              errors: {},
            })
            .resolvesToOnce({
              results: [],
              values: {},
              // handler executor errors on the third run
              errors: {
                foo: 'error',
              },
            }),
        }),
        DiscoveryLogger.SILENT,
      )

      const contractParameters: ContractParameters = {
        name: 'name',
        address,
        upgradeability: { type: 'immutable' },
        values,
      }
      const overrides: ContractOverrides = { address }
      const abis = {
        [address.toString()]: ['function foo()'],
      }

      const result = await addressAnalyzer.watchContract(
        contractParameters,
        overrides,
        BLOCK_NUMBER,
        abis,
      )
      expect(result).toEqual(false)

      const changedResult = await addressAnalyzer.watchContract(
        contractParameters,
        overrides,
        BLOCK_NUMBER,
        abis,
      )
      expect(changedResult).toEqual(true)

      await expect(
        async () =>
          await addressAnalyzer.watchContract(
            contractParameters,
            overrides,
            BLOCK_NUMBER,
            abis,
          ),
      ).toBeRejected()
    })

    it('handles proxy contracts', async () => {
      const proxy = EthereumAddress.random()
      const proxyValues = { foo: 'bar' }

      const implementation = EthereumAddress.random()
      const implementationValues = { bar: 'baz' }

      const values = { ...proxyValues, ...implementationValues }

      const addressAnalyzer = new AddressAnalyzer(
        mockObject<DiscoveryProvider>({
          getCode: async () => Bytes.fromHex('0x10'),
        }),
        mockObject<ProxyDetector>(),
        mockObject<SourceCodeService>({
          getRelevantAbi: (abis) => [...(abis[0] ?? []), ...(abis[1] ?? [])],
        }),
        mockObject<HandlerExecutor>({
          execute: mockFn()
            .resolvesToOnce({
              results: [],
              values,
              errors: {},
            })
            .resolvesToOnce({
              results: [],
              values: { ...proxyValues, bar: 'changed' },
              errors: {},
            }),
        }),
        DiscoveryLogger.SILENT,
      )

      const contractParameters: ContractParameters = {
        name: 'name',
        address: proxy,
        upgradeability: { type: 'immutable' },
        implementations: [implementation],
        values,
      }
      const overrides: ContractOverrides = { address: proxy }
      const abis = {
        [proxy.toString()]: ['function foo()'],
        [implementation.toString()]: ['function bar()'],
      }

      const result = await addressAnalyzer.watchContract(
        contractParameters,
        overrides,
        BLOCK_NUMBER,
        abis,
      )
      expect(result).toEqual(false)

      const changedResult = await addressAnalyzer.watchContract(
        contractParameters,
        overrides,
        BLOCK_NUMBER,
        abis,
      )
      expect(changedResult).toEqual(true)
    })

    it('handles unverified contracts', async () => {
      const address = EthereumAddress.random()

      const addressAnalyzer = new AddressAnalyzer(
        mockObject<DiscoveryProvider>({
          getMetadata: mockFn()
            .resolvesToOnce({
              name: '',
              isVerified: false,
              abi: [],
              source: '',
            })
            .resolvesToOnce({
              name: '',
              isVerified: true,
              abi: [],
              source: '',
            }),
        }),
        mockObject<ProxyDetector>(),
        mockObject<SourceCodeService>({
          getRelevantAbi: (abis) => abis[0] ?? [],
        }),
        mockObject<HandlerExecutor>(),
        DiscoveryLogger.SILENT,
      )

      const contractParameters: ContractParameters = {
        name: 'name',
        address,
        upgradeability: { type: 'immutable' },
        unverified: true,
      }
      const overrides: ContractOverrides = { address }

      const result = await addressAnalyzer.watchContract(
        contractParameters,
        overrides,
        BLOCK_NUMBER,
        {},
      )

      expect(result).toEqual(false)

      const changedResult = await addressAnalyzer.watchContract(
        contractParameters,
        overrides,
        BLOCK_NUMBER,
        {},
      )

      expect(changedResult).toEqual(true)
    })
  })

  it(AddressAnalyzer.prototype.watchEoa.name, async () => {
    const addressAnalyzer = new AddressAnalyzer(
      mockObject<DiscoveryProvider>({
        getCode: mockFn()
          .resolvesToOnce(Bytes.EMPTY)
          .resolvesToOnce(Bytes.fromHex('0x10')),
      }),
      mockObject<ProxyDetector>(),
      mockObject<SourceCodeService>(),
      mockObject<HandlerExecutor>(),
      DiscoveryLogger.SILENT,
    )

    const address = EthereumAddress.random()

    const result = await addressAnalyzer.watchEoa(address, BLOCK_NUMBER)

    expect(result).toEqual(false)

    const changedResult = await addressAnalyzer.watchEoa(address, BLOCK_NUMBER)

    expect(changedResult).toEqual(true)
  })
})
