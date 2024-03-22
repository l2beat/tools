import { expect } from 'earl'

import { toRanges } from './toRanges'
import { Configuration } from './types'

describe(toRanges.name, () => {
  it('empty', () => {
    const ranges = toRanges([])
    expect(ranges).toEqual([
      { from: -Infinity, to: Infinity, configurations: [] },
    ])
  })

  it('single infinite configuration', () => {
    const ranges = toRanges([actual('a', 100, null)])
    expect(ranges).toEqual([
      { from: -Infinity, to: 99, configurations: [] },
      { from: 100, to: Infinity, configurations: [actual('a', 100, null)] },
    ])
  })

  it('single finite configuration', () => {
    const ranges = toRanges([actual('a', 100, 300)])
    expect(ranges).toEqual([
      { from: -Infinity, to: 99, configurations: [] },
      { from: 100, to: 300, configurations: [actual('a', 100, 300)] },
      { from: 301, to: Infinity, configurations: [] },
    ])
  })

  it('multiple overlapping configurations', () => {
    const ranges = toRanges([
      actual('a', 100, 300),
      actual('b', 200, 400),
      actual('c', 300, 500),
    ])
    expect(ranges).toEqual([
      { from: -Infinity, to: 99, configurations: [] },
      { from: 100, to: 199, configurations: [actual('a', 100, 300)] },
      {
        from: 200,
        to: 299,
        configurations: [actual('a', 100, 300), actual('b', 200, 400)],
      },
      {
        from: 300,
        to: 300,
        configurations: [
          actual('a', 100, 300),
          actual('b', 200, 400),
          actual('c', 300, 500),
        ],
      },
      {
        from: 301,
        to: 400,
        configurations: [actual('b', 200, 400), actual('c', 300, 500)],
      },
      { from: 401, to: 500, configurations: [actual('c', 300, 500)] },
      { from: 501, to: Infinity, configurations: [] },
    ])
  })

  it('multiple non-overlapping configurations', () => {
    const ranges = toRanges([
      actual('a', 100, 200),
      actual('b', 300, 400),
      actual('c', 500, 600),
    ])
    expect(ranges).toEqual([
      { from: -Infinity, to: 99, configurations: [] },
      { from: 100, to: 200, configurations: [actual('a', 100, 200)] },
      { from: 201, to: 299, configurations: [] },
      { from: 300, to: 400, configurations: [actual('b', 300, 400)] },
      { from: 401, to: 499, configurations: [] },
      { from: 500, to: 600, configurations: [actual('c', 500, 600)] },
      { from: 601, to: Infinity, configurations: [] },
    ])
  })
})

function actual(
  id: string,
  minHeight: number,
  maxHeight: number | null,
): Configuration<null> {
  return { id, properties: null, minHeight, maxHeight }
}
