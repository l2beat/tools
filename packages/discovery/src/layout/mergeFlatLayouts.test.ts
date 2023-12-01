import { expect } from 'earl'

import { mergeFlatLayouts } from './mergeFlatLayouts'
import { SlotView } from './SlotView'

describe(mergeFlatLayouts.name, () => {
  it('identical item', () => {
    const a: SlotView[] = [
      {
        kind: 'static single',
        path: [],
        slot: 0,
        variable: {
          name: 'x',
          aliases: [],
          offset: 0,
          size: 32,
          type: 'uint256',
        },
      },
      {
        kind: 'static composite',
        path: [],
        slot: 1,
        variables: [
          {
            name: 'a',
            aliases: ['c'],
            offset: 0,
            size: 16,
            type: 'uint128',
          },
          {
            name: 'b',
            aliases: ['b1'],
            offset: 16,
            size: 16,
            type: 'uint128',
          },
        ],
      },
    ]
    const b: SlotView[] = [
      {
        kind: 'static single',
        path: [],
        slot: 0,
        variable: {
          name: 'x',
          aliases: [],
          offset: 0,
          size: 32,
          type: 'uint256',
        },
      },
      {
        kind: 'static composite',
        path: [],
        slot: 1,
        variables: [
          {
            name: 'a',
            aliases: ['c'],
            offset: 0,
            size: 16,
            type: 'uint128',
          },
          {
            name: 'b',
            aliases: ['b1'],
            offset: 16,
            size: 16,
            type: 'uint128',
          },
        ],
      },
    ]
    expect(mergeFlatLayouts([a, b])).toEqual(a)
  })

  it('renamed item', () => {
    const a: SlotView[] = [
      {
        kind: 'static single',
        path: [],
        slot: 0,
        variable: {
          name: 'x',
          aliases: [],
          offset: 0,
          size: 32,
          type: 'uint256',
        },
      },
      {
        kind: 'static composite',
        path: [],
        slot: 1,
        variables: [
          {
            name: 'a',
            aliases: ['c'],
            offset: 0,
            size: 16,
            type: 'uint128',
          },
          {
            name: 'b',
            aliases: ['b1'],
            offset: 16,
            size: 16,
            type: 'uint128',
          },
        ],
      },
    ]
    const b: SlotView[] = [
      {
        kind: 'static single',
        path: [],
        slot: 0,
        variable: {
          name: 'y',
          aliases: [],
          offset: 0,
          size: 32,
          type: 'uint256',
        },
      },
      {
        kind: 'static composite',
        path: [],
        slot: 1,
        variables: [
          {
            name: 'c',
            aliases: [],
            offset: 0,
            size: 16,
            type: 'uint128',
          },
          {
            name: 'd',
            aliases: [],
            offset: 16,
            size: 16,
            type: 'uint128',
          },
        ],
      },
    ]
    expect(mergeFlatLayouts([a, b])).toEqual([
      {
        kind: 'static single',
        path: [],
        slot: 0,
        variable: {
          name: 'x',
          aliases: ['y'],
          offset: 0,
          size: 32,
          type: 'uint256',
        },
      },
      {
        kind: 'static composite',
        path: [],
        slot: 1,
        variables: [
          {
            name: 'a',
            aliases: ['c'],
            offset: 0,
            size: 16,
            type: 'uint128',
          },
          {
            name: 'b',
            aliases: ['b1', 'd'],
            offset: 16,
            size: 16,
            type: 'uint128',
          },
        ],
      },
    ])
  })

  it('different item', () => {
    const a: SlotView[] = [
      {
        kind: 'static single',
        path: [],
        slot: 0,
        variable: {
          name: 'x',
          aliases: [],
          offset: 0,
          size: 32,
          type: 'uint256',
        },
      },
      {
        kind: 'static composite',
        path: [],
        slot: 1,
        variables: [
          {
            name: 'a',
            aliases: ['c'],
            offset: 0,
            size: 16,
            type: 'uint128',
          },
          {
            name: 'b',
            aliases: ['b1'],
            offset: 16,
            size: 16,
            type: 'uint128',
          },
        ],
      },
    ]
    const b: SlotView[] = [
      {
        kind: 'static single',
        path: [],
        slot: 0,
        variable: {
          name: 'y',
          aliases: [],
          offset: 0,
          size: 20,
          type: 'address',
        },
      },
      {
        kind: 'static composite',
        path: [],
        slot: 1,
        variables: [
          {
            name: 'c',
            aliases: [],
            offset: 0,
            size: 20,
            type: 'address',
          },
          {
            name: 'd',
            aliases: [],
            offset: 20,
            size: 1,
            type: 'bool',
          },
        ],
      },
    ]
    expect(mergeFlatLayouts([a, b])).toEqual([
      {
        kind: 'static single',
        path: [],
        slot: 0,
        variable: {
          name: 'x',
          aliases: [],
          offset: 0,
          size: 32,
          type: 'uint256',
        },
      },
      {
        kind: 'static single',
        path: [],
        slot: 0,
        variable: {
          name: 'y',
          aliases: [],
          offset: 0,
          size: 20,
          type: 'address',
        },
      },
      {
        kind: 'static composite',
        path: [],
        slot: 1,
        variables: [
          {
            name: 'a',
            aliases: ['c'],
            offset: 0,
            size: 16,
            type: 'uint128',
          },
          {
            name: 'b',
            aliases: ['b1'],
            offset: 16,
            size: 16,
            type: 'uint128',
          },
        ],
      },
      {
        kind: 'static composite',
        path: [],
        slot: 1,
        variables: [
          {
            name: 'c',
            aliases: [],
            offset: 0,
            size: 20,
            type: 'address',
          },
          {
            name: 'd',
            aliases: [],
            offset: 20,
            size: 1,
            type: 'bool',
          },
        ],
      },
    ])
  })

  it('recursive array', () => {
    const a: SlotView[] = [
      {
        kind: 'dynamic array',
        path: [],
        slot: 0,
        variable: {
          name: 'array',
          aliases: [],
          offset: 0,
          size: 32,
          type: 'struct S[]',
        },
        itemView: [
          {
            kind: 'static single',
            path: ['array', '#'],
            slot: 0,
            variable: {
              name: 'x',
              aliases: [],
              offset: 0,
              size: 32,
              type: 'uint256',
            },
          },
          {
            kind: 'static single',
            path: ['array', '#'],
            slot: 1,
            variable: {
              name: 'y',
              aliases: [],
              offset: 32,
              size: 32,
              type: 'uint256',
            },
          },
        ],
      },
    ]
    const b: SlotView[] = [
      {
        kind: 'dynamic array',
        path: [],
        slot: 0,
        variable: {
          name: 'array',
          aliases: [],
          offset: 0,
          size: 32,
          type: 'struct S[]',
        },
        itemView: [
          {
            kind: 'static single',
            path: ['array', '#'],
            slot: 0,
            variable: {
              name: 'a',
              aliases: [],
              offset: 0,
              size: 32,
              type: 'uint256',
            },
          },
          {
            kind: 'static single',
            path: ['array', '#'],
            slot: 1,
            variable: {
              name: 'b',
              aliases: [],
              offset: 32,
              size: 32,
              type: 'uint256',
            },
          },
        ],
      },
    ]
    expect(mergeFlatLayouts([a, b])).toEqual([
      {
        kind: 'dynamic array',
        path: [],
        slot: 0,
        variable: {
          name: 'array',
          aliases: [],
          offset: 0,
          size: 32,
          type: 'struct S[]',
        },
        itemView: [
          {
            kind: 'static single',
            path: ['array', '#'],
            slot: 0,
            variable: {
              name: 'x',
              aliases: ['a'],
              offset: 0,
              size: 32,
              type: 'uint256',
            },
          },
          {
            kind: 'static single',
            path: ['array', '#'],
            slot: 1,
            variable: {
              name: 'y',
              aliases: ['b'],
              offset: 32,
              size: 32,
              type: 'uint256',
            },
          },
        ],
      },
    ])
  })

  it('recursive mapping', () => {
    const a: SlotView[] = [
      {
        kind: 'dynamic mapping',
        path: [],
        slot: 0,
        variable: {
          name: 'map',
          aliases: [],
          offset: 0,
          size: 32,
          type: 'mapping(uint256 => struct S)',
        },
        keyType: 'uint256',
        valueView: [
          {
            kind: 'static single',
            path: ['array', '#'],
            slot: 0,
            variable: {
              name: 'x',
              aliases: [],
              offset: 0,
              size: 32,
              type: 'uint256',
            },
          },
          {
            kind: 'static single',
            path: ['array', '#'],
            slot: 1,
            variable: {
              name: 'y',
              aliases: [],
              offset: 32,
              size: 32,
              type: 'uint256',
            },
          },
        ],
      },
    ]
    const b: SlotView[] = [
      {
        kind: 'dynamic mapping',
        path: [],
        slot: 0,
        variable: {
          name: 'map',
          aliases: [],
          offset: 0,
          size: 32,
          type: 'mapping(uint256 => struct S)',
        },
        keyType: 'uint256',
        valueView: [
          {
            kind: 'static single',
            path: ['array', '#'],
            slot: 0,
            variable: {
              name: 'a',
              aliases: [],
              offset: 0,
              size: 32,
              type: 'uint256',
            },
          },
          {
            kind: 'static single',
            path: ['array', '#'],
            slot: 1,
            variable: {
              name: 'b',
              aliases: [],
              offset: 32,
              size: 32,
              type: 'uint256',
            },
          },
        ],
      },
    ]
    expect(mergeFlatLayouts([a, b])).toEqual([
      {
        kind: 'dynamic mapping',
        path: [],
        slot: 0,
        variable: {
          name: 'map',
          aliases: [],
          offset: 0,
          size: 32,
          type: 'mapping(uint256 => struct S)',
        },
        keyType: 'uint256',
        valueView: [
          {
            kind: 'static single',
            path: ['array', '#'],
            slot: 0,
            variable: {
              name: 'x',
              aliases: ['a'],
              offset: 0,
              size: 32,
              type: 'uint256',
            },
          },
          {
            kind: 'static single',
            path: ['array', '#'],
            slot: 1,
            variable: {
              name: 'y',
              aliases: ['b'],
              offset: 32,
              size: 32,
              type: 'uint256',
            },
          },
        ],
      },
    ])
  })
})
