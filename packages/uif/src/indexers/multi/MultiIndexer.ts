import { Logger } from '@l2beat/backend-tools'

import { Height } from '../../height'
import { Indexer, IndexerOptions } from '../../Indexer'
import { ChildIndexer } from '../ChildIndexer'
import { diffConfigurations } from './diffConfigurations'
import { toRanges } from './toRanges'
import {
  Configuration,
  ConfigurationRange,
  RemovalConfiguration,
  SavedConfiguration,
  UpdateConfiguration,
} from './types'

export abstract class MultiIndexer<T> extends ChildIndexer {
  private readonly ranges: ConfigurationRange<T>[]
  private saved: SavedConfiguration<T>[] = []

  constructor(
    logger: Logger,
    parents: Indexer[],
    readonly configurations: Configuration<T>[],
    options?: IndexerOptions,
  ) {
    super(logger, parents, options)
    this.ranges = toRanges(configurations)
  }

  /**
   * Initializes the indexer. It returns the configurations that were saved
   * previously. In case no configurations were saved, it should return an empty
   * array.
   *
   * This method is expected to read the configurations that was saved
   * previously with `setStoredConfigurations`. It shouldn't call
   * `setStoredConfigurations` itself.
   */
  abstract multiInitialize(): Promise<SavedConfiguration<T>[]>

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
   * `currentHeight` and `targetHeight`. Some of those configurations might
   * have been synced previously for this range. Those configurations
   * will include the `hasData` flag set to `true`.
   *
   * @returns The height that the indexer has synced up to. Returning
   * `currentHeight` means that the indexer has not synced any data. Returning
   * a value greater than `currentHeight` means that the indexer has synced up
   * to that height. Returning a value less than `currentHeight` or greater than
   * `targetHeight` is not permitted.
   */
  abstract multiUpdate(
    currentHeight: number,
    targetHeight: number,
    configurations: UpdateConfiguration<T>[],
  ): Promise<number>

  /**
   * Removes data that was previously synced but because configurations changed
   * is no longer valid. The data should be removed for the ranges specified
   * in each configuration. It is possible for multiple ranges to share a
   * configuration id!
   *
   * This method can only be called during the initialization of the indexer,
   * after `multiInitialize` returns.
   */
  abstract removeData(configurations: RemovalConfiguration<T>[]): Promise<void>

  /**
   * Saves configurations that the indexer should use to sync data. The
   * configurations saved here should be read in the `multiInitialize` method.
   *
   * @param configurations The configurations that the indexer should save. The
   * indexer should save the returned configurations and ensure that no other
   * configurations are persisted.
   */
  abstract saveConfigurations(
    configurations: SavedConfiguration<T>[],
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
    const range = findRange(this.ranges, currentHeight)
    if (
      range.configurations.length === 0 ||
      // This check is only necessary for TypeScript. If currentHeight is null
      // then the first condition will always be true
      currentHeight === null
    ) {
      return Height.min(range.to, targetHeight)
    }

    const { configurations, minCurrentHeight } = getConfigurationsInRange(
      range,
      this.saved,
      currentHeight,
    )
    const minTargetHeight = Math.min(range.to, targetHeight, minCurrentHeight)

    const newHeight = await this.multiUpdate(
      currentHeight,
      minTargetHeight,
      configurations,
    )
    if (newHeight < currentHeight || newHeight > minTargetHeight) {
      throw new Error(
        'Programmer error, returned height must be between currentHeight and targetHeight.',
      )
    }

    if (newHeight > currentHeight) {
      updateSavedConfigurations(this.saved, configurations, newHeight)
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

function findRange<T>(
  ranges: ConfigurationRange<T>[],
  currentHeight: number | null,
): ConfigurationRange<T> {
  const range = ranges.find(
    (range) =>
      currentHeight === null ||
      (range.from <= currentHeight + 1 && range.to > currentHeight),
  )
  if (!range) {
    throw new Error('Programmer error, there should always be a range')
  }
  return range
}

function getConfigurationsInRange<T>(
  range: ConfigurationRange<T>,
  savedConfigurations: SavedConfiguration<T>[],
  currentHeight: number,
): { configurations: UpdateConfiguration<T>[]; minCurrentHeight: number } {
  let minCurrentHeight = Infinity
  const configurations = range.configurations.map(
    (configuration): UpdateConfiguration<T> => {
      const saved = savedConfigurations.find((c) => c.id === configuration.id)
      if (saved && saved.currentHeight > currentHeight) {
        minCurrentHeight = Math.min(minCurrentHeight, saved.currentHeight)
        return { ...configuration, hasData: true }
      } else {
        return { ...configuration, hasData: false }
      }
    },
  )
  return { configurations, minCurrentHeight }
}

function updateSavedConfigurations<T>(
  savedConfigurations: SavedConfiguration<T>[],
  updatedConfigurations: UpdateConfiguration<T>[],
  newHeight: number,
): void {
  for (const updated of updatedConfigurations) {
    const saved = savedConfigurations.find((c) => c.id === updated.id)
    if (!saved) {
      savedConfigurations.push({
        id: updated.id,
        properties: updated.properties,
        minHeight: updated.minHeight,
        currentHeight: newHeight,
      })
    } else {
      // TODO: test this
      saved.currentHeight = Math.max(saved.currentHeight, newHeight)
    }
  }
}
