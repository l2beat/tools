import { Logger } from '@l2beat/backend-tools'

import { BaseIndexer } from '../../BaseIndexer'
import { Height } from '../../height'
import { RetryStrategy } from '../../Retries'
import { ChildIndexer, IChildIndexer } from '../ChildIndexer'
import { diffConfigurations } from './diffConfigurations'
import { toRanges } from './toRanges'
import {
  Configuration,
  ConfigurationRange,
  RemovalConfiguration,
  StoredConfiguration,
} from './types'

export interface IMultiIndexer<T> {
  /**
   * Initializes the indexer. It returns the configurations that were saved
   * previously. In case no configurations were saved, it should return an empty
   * array.
   *
   * This method is expected to read the configurations that was saved
   * previously with `setStoredConfigurations`. It shouldn't call
   * `setStoredConfigurations` itself.
   */
  multiInitialize: () => Promise<StoredConfiguration<T>[]>

  /**
   * Removes data that was previously synced but because configurations changed
   * is no longer valid. The data should be removed for the ranges specified
   * in each configuration. It is possible for multiple ranges to share a
   * configuration id!
   *
   * This method is only called during the initialization of the indexer, after
   * `multiInitialize` returns.
   */
  removeData: (configurations: RemovalConfiguration<T>[]) => Promise<void>

  /**
   *
   * @param currentHeight The height that the indexer has synced up to previously. Can
   * be `null` if no data was synced. This value is exclusive so the indexer
   * should not fetch data for this height.
   *
   * @param targetHeight The height that the indexer should sync up to. This value is
   * inclusive so the indexer should eventually fetch data for this height.
   *
   * @param configurations foo
   *
   * @returns The height that the indexer has synced up to. Returning
   * `currentHeight` means that the indexer has not synced any data. Returning
   * a value greater than `currentHeight` means that the indexer has synced up
   * to that height. Returning a value less than `currentHeight` will trigger
   * invalidation down to the returned value. Returning `null` will invalidate
   * all data. Returning a value greater than `targetHeight` is not permitted.
   */
  multiUpdate: (
    currentHeight: number | null,
    targetHeight: number,
    configurations: Configuration<T>[],
  ) => Promise<number | null>

  setStoredConfigurations: (
    configurations: StoredConfiguration<T>[],
  ) => Promise<void>
}

export abstract class MultiIndexer<T>
  extends ChildIndexer
  implements IChildIndexer, IMultiIndexer<T>
{
  private readonly ranges: ConfigurationRange<T>[]

  constructor(
    logger: Logger,
    parents: BaseIndexer[],
    readonly configurations: Configuration<T>[],
    opts?: {
      updateRetryStrategy?: RetryStrategy
      invalidateRetryStrategy?: RetryStrategy
    },
  ) {
    super(logger, parents, opts)
    this.ranges = toRanges(configurations)
  }

  abstract multiInitialize(): Promise<StoredConfiguration<T>[]>
  abstract multiUpdate(
    currentHeight: number | null,
    targetHeight: number,
    configurations: Configuration<T>[],
  ): Promise<number | null>
  abstract removeData(configurations: RemovalConfiguration<T>[]): Promise<void>
  abstract setStoredConfigurations(
    configurations: StoredConfiguration<T>[],
  ): Promise<void>

  async initialize(): Promise<number | null> {
    const stored = await this.multiInitialize()
    const { toRemove, safeHeight } = diffConfigurations(
      this.configurations,
      stored,
    )
    await this.removeData(toRemove)
    return safeHeight
  }

  async update(
    currentHeight: number | null,
    targetHeight: number,
  ): Promise<number | null> {
    const range = this.ranges.find((range) =>
      Height.gt(range.from, currentHeight),
    )
    if (!range) {
      throw new Error('Programmer error, there should always be a range')
    }
    if (range.configurations.length === 0) {
      return Height.min(range.to, targetHeight)
    }

    const minTarget = Math.min(range.to, targetHeight)

    const newHeight = await this.multiUpdate(
      currentHeight,
      minTarget,
      range.configurations,
    )
    if (Height.gt(newHeight, minTarget)) {
      throw new Error(
        'Programmer error, returned height cannot be greater than targetHeight',
      )
    }
    return newHeight
  }

  async invalidate(targetHeight: number | null): Promise<number | null> {
    return Promise.resolve(targetHeight)
  }

  async setSafeHeight(): Promise<void> {
    return Promise.resolve()
  }
}
