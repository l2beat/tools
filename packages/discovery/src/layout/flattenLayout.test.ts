import { expect } from 'earl'

import { flattenLayout } from './flattenLayout'

describe(flattenLayout.name, () => {
  it('works for the example from solidity docs', () => {
    const result = flattenLayout([
      {
        name: 'x',
        kind: 'static',
        type: 'uint256',
        slot: 0,
        offset: 0,
        size: 32,
      },
      {
        name: 'y',
        kind: 'static',
        type: 'uint256',
        slot: 1,
        offset: 0,
        size: 32,
      },
      {
        name: 's',
        kind: 'struct',
        type: 'struct A.S',
        slot: 2,
        offset: 0,
        size: 32 * 4,
        children: [
          {
            name: 'a',
            kind: 'static',
            type: 'uint128',
            slot: 0,
            offset: 0,
            size: 16,
          },
          {
            name: 'b',
            kind: 'static',
            type: 'uint128',
            slot: 0,
            offset: 16,
            size: 16,
          },
          {
            name: 'staticArray',
            kind: 'static array',
            type: 'uint256[2]',
            slot: 1,
            offset: 0,
            size: 32 * 2,
            length: 2,
            item: {
              kind: 'static',
              type: 'uint256',
              size: 32,
            },
          },
          {
            name: 'dynArray',
            kind: 'dynamic array',
            type: 'uint256[]',
            slot: 3,
            offset: 0,
            size: 32,
            item: {
              kind: 'static',
              type: 'uint256',
              size: 32,
            },
          },
        ],
      },
      {
        name: 'addr',
        kind: 'static',
        type: 'address',
        slot: 6,
        offset: 0,
        size: 20,
      },
      {
        name: 'map',
        kind: 'mapping',
        type: 'mapping(uint256 => mapping(address => bool))',
        slot: 7,
        offset: 0,
        size: 32,
        key: {
          kind: 'static',
          type: 'uint256',
          size: 32,
        },
        value: {
          kind: 'mapping',
          type: 'mapping(address => bool)',
          size: 32,
          key: {
            kind: 'static',
            type: 'address',
            size: 20,
          },
          value: {
            kind: 'static',
            type: 'bool',
            size: 1,
          },
        },
      },
      {
        name: 'array',
        kind: 'dynamic array',
        type: 'uint256[]',
        slot: 8,
        offset: 0,
        size: 32,
        item: {
          kind: 'static',
          type: 'uint256',
          size: 32,
        },
      },
      {
        name: 's1',
        kind: 'dynamic bytes',
        type: 'string',
        slot: 9,
        offset: 0,
        size: 32,
      },
      {
        name: 'b1',
        kind: 'dynamic bytes',
        type: 'bytes',
        slot: 10,
        offset: 0,
        size: 32,
      },
    ])

    expect(result).toEqual([
      {
        kind: 'static single',
        slot: 0,
        path: [],
        variable: {
          name: 'x',
          aliases: [],
          type: 'uint256',
          offset: 0,
          size: 32,
        },
      },
      {
        kind: 'static single',
        path: [],
        slot: 1,
        variable: {
          name: 'y',
          aliases: [],
          type: 'uint256',
          offset: 0,
          size: 32,
        },
      },
      {
        kind: 'static composite',
        path: ['s'],
        slot: 2,
        variables: [
          {
            name: 'a',
            aliases: [],
            type: 'uint128',
            offset: 0,
            size: 16,
          },
          {
            name: 'b',
            aliases: [],
            type: 'uint128',
            offset: 16,
            size: 16,
          },
        ],
      },
      {
        kind: 'static single',
        path: ['s', 'staticArray'],
        slot: 3,
        variable: {
          name: '0',
          aliases: [],
          type: 'uint256',
          offset: 0,
          size: 32,
        },
      },
      {
        kind: 'static single',
        path: ['s', 'staticArray'],
        slot: 4,
        variable: {
          name: '1',
          aliases: [],
          type: 'uint256',
          offset: 0,
          size: 32,
        },
      },
      {
        kind: 'dynamic array',
        path: ['s'],
        slot: 5,
        variable: {
          name: 'dynArray',
          aliases: [],
          type: 'uint256[]',
          offset: 0,
          size: 32,
        },
        itemView: [
          {
            kind: 'static single',
            path: ['s', 'dynArray'],
            slot: 0,
            variable: {
              name: '#',
              aliases: [],
              type: 'uint256',
              offset: 0,
              size: 32,
            },
          },
        ],
      },
      {
        kind: 'static single',
        path: [],
        slot: 6,
        variable: {
          name: 'addr',
          aliases: [],
          type: 'address',
          offset: 0,
          size: 20,
        },
      },
      {
        kind: 'dynamic mapping',
        path: [],
        slot: 7,
        variable: {
          name: 'map',
          aliases: [],
          type: 'mapping(uint256 => mapping(address => bool))',
          offset: 0,
          size: 32,
        },
        keyType: 'uint256',
        valueView: [
          {
            kind: 'dynamic mapping',
            path: ['map'],
            slot: 0,
            variable: {
              name: '*',
              aliases: [],
              type: 'mapping(address => bool)',
              offset: 0,
              size: 32,
            },
            keyType: 'address',
            valueView: [
              {
                kind: 'static single',
                path: ['map', '*'],
                slot: 0,
                variable: {
                  name: '*',
                  aliases: [],
                  type: 'bool',
                  offset: 0,
                  size: 1,
                },
              },
            ],
          },
        ],
      },
      {
        kind: 'dynamic array',
        path: [],
        slot: 8,
        variable: {
          name: 'array',
          aliases: [],
          type: 'uint256[]',
          offset: 0,
          size: 32,
        },
        itemView: [
          {
            kind: 'static single',
            path: ['array'],
            slot: 0,
            variable: {
              name: '#',
              aliases: [],
              type: 'uint256',
              offset: 0,
              size: 32,
            },
          },
        ],
      },
      {
        kind: 'dynamic bytes',
        path: [],
        slot: 9,
        variable: {
          name: 's1',
          aliases: [],
          type: 'string',
          offset: 0,
          size: 32,
        },
      },
      {
        kind: 'dynamic bytes',
        path: [],
        slot: 10,
        variable: {
          aliases: [],
          name: 'b1',
          type: 'bytes',
          offset: 0,
          size: 32,
        },
      },
    ])
  })
})
