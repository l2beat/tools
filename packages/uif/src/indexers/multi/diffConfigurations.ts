import { Height } from '../../height'
import {
  Configuration,
  RemovalConfiguration,
  StoredConfiguration,
} from './types'

export function diffConfigurations(
  actual: Configuration<unknown>[],
  stored: StoredConfiguration[],
): {
  toRemove: RemovalConfiguration[]
  safeHeight: number | null
} {
  let safeHeight: number | null = Infinity

  const knownIds = new Set<string>()
  const actualMap = new Map(actual.map((c) => [c.id, c]))
  const storedMap = new Map(stored.map((c) => [c.id, c]))

  const toRemove: RemovalConfiguration[] = stored
    .filter((c) => !actualMap.has(c.id))
    .map((c) => ({
      id: c.id,
      fromHeightInclusive: c.minHeight,
      toHeightInclusive: c.currentHeight,
    }))

  for (const c of actual) {
    if (knownIds.has(c.id)) {
      throw new Error(`Configuration ${c.id} is duplicated!`)
    }
    knownIds.add(c.id)

    if (c.maxHeight !== null && c.minHeight > c.maxHeight) {
      throw new Error(
        `Configuration ${c.id} has minHeight greater than maxHeight!`,
      )
    }

    const stored = storedMap.get(c.id)
    if (!stored) {
      safeHeight = Height.min(safeHeight, c.minHeight - 1)
      continue
    }

    if (stored.minHeight > c.minHeight) {
      safeHeight = Height.min(safeHeight, c.minHeight - 1)
      // We remove everything because we cannot have gaps in downloaded data
      // We will re-download everything from the beginning
      toRemove.push({
        id: stored.id,
        fromHeightInclusive: stored.minHeight,
        toHeightInclusive: stored.currentHeight,
      })
    } else if (stored.minHeight < c.minHeight) {
      toRemove.push({
        id: stored.id,
        fromHeightInclusive: stored.minHeight,
        toHeightInclusive: c.minHeight - 1,
      })
    }

    if (c.maxHeight !== null && stored.currentHeight > c.maxHeight) {
      toRemove.push({
        id: stored.id,
        fromHeightInclusive: c.maxHeight + 1,
        toHeightInclusive: stored.currentHeight,
      })
    } else if (
      c.maxHeight === null ||
      Height.lt(stored.currentHeight, c.maxHeight)
    ) {
      safeHeight = Height.min(safeHeight, stored.currentHeight)
    }
  }

  return { toRemove, safeHeight }
}
