import {
  Configuration,
  RemovalConfiguration,
  SavedConfiguration,
} from './types'

export function diffConfigurations<T>(
  actual: Configuration<T>[],
  saved: SavedConfiguration<T>[],
): {
  toRemove: RemovalConfiguration<T>[]
  toSave: SavedConfiguration<T>[]
  safeHeight: number
} {
  let safeHeight = Infinity

  const knownIds = new Set<string>()
  const actualMap = new Map(actual.map((c) => [c.id, c]))
  const savedMap = new Map(saved.map((c) => [c.id, c]))

  const toRemove: RemovalConfiguration<T>[] = saved
    .filter((c) => !actualMap.has(c.id))
    .map((c) => ({
      id: c.id,
      properties: c.properties,
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

    const stored = savedMap.get(c.id)
    if (!stored) {
      safeHeight = Math.min(safeHeight, c.minHeight - 1)
      continue
    }

    if (stored.minHeight > c.minHeight) {
      safeHeight = Math.min(safeHeight, c.minHeight - 1)
      // We remove everything because we cannot have gaps in downloaded data
      // We will re-download everything from the beginning
      toRemove.push({
        id: stored.id,
        properties: stored.properties,
        fromHeightInclusive: stored.minHeight,
        toHeightInclusive: stored.currentHeight,
      })
    } else if (stored.minHeight < c.minHeight) {
      toRemove.push({
        id: stored.id,
        properties: stored.properties,
        fromHeightInclusive: stored.minHeight,
        toHeightInclusive: c.minHeight - 1,
      })
    }

    if (c.maxHeight !== null && stored.currentHeight > c.maxHeight) {
      toRemove.push({
        id: stored.id,
        properties: stored.properties,
        fromHeightInclusive: c.maxHeight + 1,
        toHeightInclusive: stored.currentHeight,
      })
    } else if (c.maxHeight === null || stored.currentHeight < c.maxHeight) {
      safeHeight = Math.min(safeHeight, stored.currentHeight)
    }
  }

  const toSave = saved
    .map((c): SavedConfiguration<T> | undefined => {
      const actual = actualMap.get(c.id)
      if (!actual || actual.minHeight < c.minHeight) {
        return undefined
      }
      return {
        id: c.id,
        properties: c.properties,
        minHeight: actual.minHeight,
        currentHeight:
          actual.maxHeight === null
            ? c.currentHeight
            : Math.min(c.currentHeight, actual.maxHeight),
      }
    })
    .filter((c): c is SavedConfiguration<T> => c !== undefined)

  return { toRemove, toSave, safeHeight }
}
