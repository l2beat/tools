import { expect, mockFn, mockObject } from 'earl'
import { providers } from 'ethers'

import { ChainId } from '../../utils/ChainId'
import { EtherscanLikeClient } from '../../utils/EtherscanLikeClient'
import { DiscoveryLogger } from '../DiscoveryLogger'
import { DiscoveryCache, ProviderWithCache } from './ProviderWithCache'

function setupProviderWithMockCache(values: {
  curBlockNumber: number
  reorgSafeDepth: number | undefined
}) {
  const mockCache = mockObject<DiscoveryCache>({
    set: mockFn().resolvesTo(undefined),
    get: mockFn()
      .given('mockCachedKey')
      .resolvesToOnce('mockCachedValue')
      .given('mockNotCachedKey')
      .resolvesToOnce(undefined),
  })
  const mockProvider = mockObject<providers.Provider>({
    getBlockNumber: mockFn().resolvesTo(values.curBlockNumber),
  })
  const providerWithCache = new ProviderWithCache(
    mockProvider,
    mockObject<EtherscanLikeClient>({}),
    DiscoveryLogger.SILENT,
    ChainId.ETHEREUM,
    mockCache,
    undefined,
    values.reorgSafeDepth,
  )
  return { providerWithCache, mockCache }
}

describe('ProviderWithCache', () => {
  it('works when reorgSafeDepth and blockNumber is undefined, value cached', async () => {
    const { providerWithCache, mockCache } = setupProviderWithMockCache({
      curBlockNumber: 1000,
      reorgSafeDepth: undefined,
    })

    const blockNumber = undefined
    const resultCached = await providerWithCache.cacheOrFetch(
      'mockCachedKey',
      blockNumber,
      async () => 'mockNotCachedValue',
      (value) => value,
      (value) => value,
    )

    expect(resultCached).toEqual('mockCachedValue')
    expect(mockCache.get).toHaveBeenCalledWith('mockCachedKey')
    expect(mockCache.set).toHaveBeenCalledTimes(0)
  })

  it('works when reorgSafeDepth is undefined, value cached', async () => {
    const { providerWithCache, mockCache } = setupProviderWithMockCache({
      curBlockNumber: 1000,
      reorgSafeDepth: undefined,
    })

    const blockNumber = 1000
    const resultCached = await providerWithCache.cacheOrFetch(
      'mockCachedKey',
      blockNumber,
      async () => 'mockNotCachedValue',
      (value) => value,
      (value) => value,
    )

    expect(resultCached).toEqual('mockCachedValue')
    expect(mockCache.get).toHaveBeenCalledWith('mockCachedKey')
    expect(mockCache.set).toHaveBeenCalledTimes(0)
  })

  it('works when reorgSafeDepth and blockNumber is undefined, value not cached', async () => {
    const { providerWithCache, mockCache } = setupProviderWithMockCache({
      curBlockNumber: 1000,
      reorgSafeDepth: undefined,
    })

    const blockNumber = undefined
    const resultCached = await providerWithCache.cacheOrFetch(
      'mockNotCachedKey',
      blockNumber,
      async () => 'mockNotCachedValue',
      (value) => value,
      (value) => value,
    )

    expect(resultCached).toEqual('mockNotCachedValue')
    expect(mockCache.set).toHaveBeenCalledWith(
      'mockNotCachedKey',
      'mockNotCachedValue',
      1,
      blockNumber,
    )
  })

  it('works when reorgSafeDepth is undefined, value not cached', async () => {
    const { providerWithCache, mockCache } = setupProviderWithMockCache({
      curBlockNumber: 1000,
      reorgSafeDepth: undefined,
    })

    const blockNumber = 1000
    const resultCached = await providerWithCache.cacheOrFetch(
      'mockNotCachedKey',
      blockNumber,
      async () => 'mockNotCachedValue',
      (value) => value,
      (value) => value,
    )

    expect(resultCached).toEqual('mockNotCachedValue')
    expect(mockCache.set).toHaveBeenCalledWith(
      'mockNotCachedKey',
      'mockNotCachedValue',
      1,
      blockNumber,
    )
  })

  it('sets cache when reorgSafeDepth not crossed', async () => {
    const { providerWithCache, mockCache } = setupProviderWithMockCache({
      curBlockNumber: 1000,
      reorgSafeDepth: 100,
    })

    const blockNumber = 900
    const resultCached = await providerWithCache.cacheOrFetch(
      'mockNotCachedKey',
      blockNumber,
      async () => 'mockNotCachedValue',
      (value) => value,
      (value) => value,
    )

    expect(resultCached).toEqual('mockNotCachedValue')
    expect(mockCache.get).toHaveBeenCalledWith('mockNotCachedKey')
    expect(mockCache.set).toHaveBeenCalledWith(
      'mockNotCachedKey',
      'mockNotCachedValue',
      1,
      blockNumber,
    )
  })

  it("doesn't cache when reorgSafeDepth is crossed", async () => {
    const { providerWithCache, mockCache } = setupProviderWithMockCache({
      curBlockNumber: 1000,
      reorgSafeDepth: 100,
    })

    const blockNumber = 901
    const resultCached = await providerWithCache.cacheOrFetch(
      'mockNotCachedKey',
      blockNumber,
      async () => 'mockNotCachedValue',
      (value) => value,
      (value) => value,
    )

    expect(resultCached).toEqual('mockNotCachedValue')
    expect(mockCache.get).toHaveBeenCalledWith('mockNotCachedKey')
    expect(mockCache.set).toHaveBeenCalledTimes(0)
  })
})
