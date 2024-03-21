import { expect } from 'earl'

import { diffConfigurations } from './diffConfigurations'

describe(diffConfigurations.name, () => {
  describe('errors', () => {
    it('duplicate config id', () => {
      expect(() =>
        diffConfigurations([actual('a', 100, null), actual('a', 200, 300)], []),
      ).toThrow(/a is duplicated/)
    })

    it('minHeight greater than maxHeight', () => {
      expect(() => diffConfigurations([actual('a', 200, 100)], [])).toThrow(
        /a has minHeight greater than maxHeight/,
      )
    })
  })

  describe('regular sync', () => {
    it('empty actual and stored', () => {
      const result = diffConfigurations([], [])
      expect(result).toEqual({ toRemove: [], safeHeight: Infinity })
    })

    it('empty stored', () => {
      const result = diffConfigurations(
        [actual('a', 100, null), actual('b', 200, 300)],
        [],
      )
      expect(result).toEqual({ toRemove: [], safeHeight: 99 })
    })

    it('partially synced, both early', () => {
      const result = diffConfigurations(
        [actual('a', 100, 400), actual('b', 200, null)],
        [stored('a', 100, 300), stored('b', 200, 300)],
      )
      expect(result).toEqual({
        toRemove: [],
        safeHeight: 300,
      })
    })

    it('partially synced, one not yet started', () => {
      const result = diffConfigurations(
        [actual('a', 100, 400), actual('b', 555, null)],
        [stored('a', 100, 300)],
      )
      expect(result).toEqual({
        toRemove: [],
        safeHeight: 300,
      })
    })

    it('partially synced, one finished', () => {
      const result = diffConfigurations(
        [actual('a', 100, 555), actual('b', 200, 300)],
        [stored('a', 100, 400), stored('b', 200, 300)],
      )
      expect(result).toEqual({
        toRemove: [],
        safeHeight: 400,
      })
    })

    it('partially synced, one finished, one infinite', () => {
      const result = diffConfigurations(
        [actual('a', 100, null), actual('b', 200, 300)],
        [stored('a', 100, 400), stored('b', 200, 300)],
      )
      expect(result).toEqual({
        toRemove: [],
        safeHeight: 400,
      })
    })

    it('both synced', () => {
      const result = diffConfigurations(
        [actual('a', 100, 400), actual('b', 200, 300)],
        [stored('a', 100, 400), stored('b', 200, 300)],
      )
      expect(result).toEqual({
        toRemove: [],
        safeHeight: Infinity,
      })
    })
  })

  describe('configuration changed', () => {
    it('empty actual', () => {
      const result = diffConfigurations(
        [],
        [stored('a', 100, 300), stored('b', 200, 300)],
      )
      expect(result).toEqual({
        toRemove: [removal('a', 100, 300), removal('b', 200, 300)],
        safeHeight: Infinity,
      })
    })

    it('single removed', () => {
      const result = diffConfigurations(
        [actual('b', 200, 400)],
        [stored('a', 100, 300), stored('b', 200, 300)],
      )
      expect(result).toEqual({
        toRemove: [removal('a', 100, 300)],
        safeHeight: 300,
      })
    })

    it('single removed', () => {
      const result = diffConfigurations(
        [actual('b', 200, 400)],
        [stored('a', 100, 300), stored('b', 200, 300)],
      )
      expect(result).toEqual({
        toRemove: [removal('a', 100, 300)],
        safeHeight: 300,
      })
    })

    it('maxHeight updated up', () => {
      const result = diffConfigurations(
        [actual('a', 100, 400)],
        [stored('a', 100, 300)],
      )
      expect(result).toEqual({
        toRemove: [],
        safeHeight: 300,
      })
    })

    it('maxHeight updated down', () => {
      const result = diffConfigurations(
        [actual('a', 100, 200)],
        [stored('a', 100, 300)],
      )
      expect(result).toEqual({
        toRemove: [removal('a', 201, 300)],
        safeHeight: Infinity,
      })
    })

    it('minHeight updated up', () => {
      const result = diffConfigurations(
        [actual('a', 200, 400)],
        [stored('a', 100, 300)],
      )
      expect(result).toEqual({
        toRemove: [removal('a', 100, 199)],
        safeHeight: 300,
      })
    })

    it('minHeight updated down', () => {
      const result = diffConfigurations(
        [actual('a', 100, 400)],
        [stored('a', 200, 300)],
      )
      expect(result).toEqual({
        toRemove: [removal('a', 200, 300)],
        safeHeight: 99,
      })
    })

    it('both min and max height updated', () => {
      const result = diffConfigurations(
        [actual('a', 200, 300)],
        [stored('a', 100, 400)],
      )
      expect(result).toEqual({
        toRemove: [removal('a', 100, 199), removal('a', 301, 400)],
        safeHeight: Infinity,
      })
    })
  })
})

function actual(id: string, minHeight: number, maxHeight: number | null) {
  return { id, properties: null, minHeight, maxHeight }
}

function stored(id: string, minHeight: number, currentHeight: number) {
  return { id, minHeight, currentHeight }
}

function removal(
  id: string,
  fromHeightInclusive: number,
  toHeightInclusive: number,
) {
  return { id, fromHeightInclusive, toHeightInclusive }
}
