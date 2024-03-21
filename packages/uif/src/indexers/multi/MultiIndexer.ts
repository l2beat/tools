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
  SavedConfiguration,
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
  multiInitialize: () => Promise<SavedConfiguration[]>

  /**
   * Removes data that was previously synced but because configurations changed
   * is no longer valid. The data should be removed for the ranges specified
   * in each configuration. It is possible for multiple ranges to share a
   * configuration id!
   *
   * This method can only be called during the initialization of the indexer,
   * after `multiInitialize` returns.
   */
  removeData: (configurations: RemovalConfiguration[]) => Promise<void>

  /**
   * Implements the main data fetching process. It is up to the indexer to
   * decide how much data to fetch. For example given `.update(100, 200, [...])`, the
   * indexer can only fetch data up to 110 and return 110. The next time this
   * method will be called with `.update(110, 200, [...])`.
   *
   * @param currentHeight The height that the indexer has synced up to
   * previously. This value is exclusive so the indexer should not fetch data
   * for this height. If the indexer hasn't synced anything previously this
   * will equal the minimum height of all configurations - 1.
   *
   * @param targetHeight The height that the indexer should sync up to. This value is
   * inclusive so the indexer should eventually fetch data for this height.
   *
   * @param configurations The configurations that the indexer should use to
   * sync data. The configurations are guaranteed to be in the range of
   * `currentHeight` and `targetHeight`.
   *
   * @returns The height that the indexer has synced up to. Returning
   * `currentHeight` means that the indexer has not synced any data. Returning
   * a value greater than `currentHeight` means that the indexer has synced up
   * to that height. Returning a value less than `currentHeight` or greater than
   * `targetHeight` is not permitted.
   */
  multiUpdate: (
    currentHeight: number,
    targetHeight: number,
    configurations: Configuration<T>[],
  ) => Promise<number>

  /**
   * Saves configurations that the indexer should use to sync data. The
   * configurations saved here should be read in the `multiInitialize` method.
   *
   * @param configurations The configurations that the indexer should save. The
   * indexer should save the returned configurations and ensure that no other
   * configurations are persisted.
   */
  saveConfigurations: (configurations: SavedConfiguration[]) => Promise<void>
}

export abstract class MultiIndexer<T>
  extends ChildIndexer
  implements IChildIndexer, IMultiIndexer<T>
{
  private readonly ranges: ConfigurationRange<T>[]
  private saved: SavedConfiguration[] = []

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

  abstract multiInitialize(): Promise<SavedConfiguration[]>
  abstract multiUpdate(
    currentHeight: number,
    targetHeight: number,
    configurations: Configuration<T>[],
  ): Promise<number>
  abstract removeData(configurations: RemovalConfiguration[]): Promise<void>
  abstract saveConfigurations(
    configurations: SavedConfiguration[],
  ): Promise<void>

  async initialize(): Promise<number | null> {
    const saved = await this.multiInitialize()
    const { toRemove, toSave, safeHeight } = diffConfigurations(
      this.configurations,
      saved,
    )
    this.saved = toSave
    if (toRemove.length > 0) {
      await this.removeData(toRemove)
      await this.saveConfigurations(toSave)
    }
    return safeHeight
  }

  async update(
    currentHeight: number | null,
    targetHeight: number,
  ): Promise<number | null> {
    const range = this.ranges.find(
      (range) =>
        currentHeight === null ||
        (range.from <= currentHeight + 1 && range.to > currentHeight),
    )
    if (!range) {
      throw new Error('Programmer error, there should always be a range')
    }
    if (
      range.configurations.length === 0 ||
      // this check is only necessary for TypeScript. If currentHeight is null
      // then the first condition will always be true
      currentHeight === null
    ) {
      return Height.min(range.to, targetHeight)
    }

    const minTarget = Math.min(range.to, targetHeight)

    const newHeight = await this.multiUpdate(
      currentHeight,
      minTarget,
      range.configurations,
    )
    if (newHeight < currentHeight || newHeight > minTarget) {
      throw new Error(
        'Programmer error, returned height must be between currentHeight and targetHeight.',
      )
    }

    if (newHeight > currentHeight) {
      for (const configuration of range.configurations) {
        const saved = this.saved.find((c) => c.id === configuration.id)
        if (saved) {
          saved.currentHeight = newHeight
        } else {
          this.saved.push({
            id: configuration.id,
            minHeight: configuration.minHeight,
            currentHeight: newHeight,
          })
        }
      }
      await this.saveConfigurations(this.saved)
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
