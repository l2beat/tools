import { Logger } from '@l2beat/backend-tools'

import { BaseIndexer } from '../../BaseIndexer'
import { RetryStrategy } from '../../Retries'
import { ChildIndexer, IChildIndexer } from '../ChildIndexer'
import { diffConfigurations } from './diffConfigurations'
import {
  Configuration,
  ConfigurationRange,
  RemovalConfiguration,
  StoredConfiguration,
} from './types'

export interface IMultiIndexer<T> {
  multiInitialize: () => Promise<StoredConfiguration<T>[]>
  removeData: (configurations: RemovalConfiguration<T>[]) => Promise<void>
  setStoredConfigurations: (
    configurations: StoredConfiguration<T>[],
  ) => Promise<void>
}

export abstract class MultiIndexer<T>
  extends ChildIndexer
  implements IChildIndexer, IMultiIndexer<T>
{
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
  }

  abstract multiInitialize(): Promise<StoredConfiguration<T>[]>
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

  async update(from: number | null, to: number): Promise<number | null> {
    return Promise.resolve(to)
  }

  async invalidate(targetHeight: number | null): Promise<number | null> {
    return Promise.resolve(targetHeight)
  }

  async setSafeHeight(): Promise<void> {
    return Promise.resolve()
  }
}

export function toRanges<T>(
  configurations: Configuration<T>[],
): ConfigurationRange<T>[] {
  let currentRange: ConfigurationRange<T> = {
    from: null,
    to: null,
    configurations: [],
  }
  const ranges: ConfigurationRange<T>[] = [currentRange]

  const sorted = [...configurations].sort((a, b) => a.minHeight - b.minHeight)
  for (const configuration of sorted) {
    if (configuration.minHeight === currentRange.from) {
      currentRange.configurations.push(configuration)
    } else {
      currentRange.to = configuration.minHeight - 1
      currentRange = {
        from: configuration.minHeight,
        to: null,
        configurations: [configuration],
      }
      ranges.push(currentRange)
    }
  }

  return ranges
}
