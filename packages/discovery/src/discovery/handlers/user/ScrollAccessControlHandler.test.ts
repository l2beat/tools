import { expect, mockFn, mockObject } from 'earl'
import { providers, utils } from 'ethers'

import { Bytes } from '../../../utils/Bytes'
import { EthereumAddress } from '../../../utils/EthereumAddress'
import { DiscoveryLogger } from '../../DiscoveryLogger'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { ScrollAccessControlHandler } from './ScrollAccessControlHandler'

describe(ScrollAccessControlHandler.name, () => {
  const BLOCK_NUMBER = 1234

  const abi = new utils.Interface([
    'event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)',
    'event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)',
    'event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)',
    'event GrantAccess(bytes32 indexed role, address indexed target, bytes4[] selectors)',
    'event RevokeAccess(bytes32 indexed role, address indexed target, bytes4[] selectors)',
  ])

  function RoleGranted(role: string, account: EthereumAddress): providers.Log {
    return abi.encodeEventLog(abi.getEvent('RoleGranted'), [
      role,
      account,
      EthereumAddress.ZERO,
    ]) as providers.Log
  }

  function RoleRevoked(role: string, account: EthereumAddress): providers.Log {
    return abi.encodeEventLog(abi.getEvent('RoleRevoked'), [
      role,
      account,
      EthereumAddress.ZERO,
    ]) as providers.Log
  }

  function RoleAdminChanged(role: string, adminRole: string): providers.Log {
    return abi.encodeEventLog(abi.getEvent('RoleAdminChanged'), [
      role,
      '0x' + '0'.repeat(64),
      adminRole,
    ]) as providers.Log
  }

  function GrantAccess(
    role: string,
    address: EthereumAddress,
    selectors: string[],
  ): providers.Log {
    return abi.encodeEventLog(abi.getEvent('GrantAccess'), [
      role,
      address,
      selectors,
    ]) as providers.Log
  }

  function RevokeAccess(
    role: string,
    address: EthereumAddress,
    selectors: string[],
  ): providers.Log {
    return abi.encodeEventLog(abi.getEvent('RevokeAccess'), [
      role,
      address,
      selectors,
    ]) as providers.Log
  }

  it('no logs', async () => {
    const address = EthereumAddress.random()
    const provider = mockObject<DiscoveryProvider>({
      async getLogs(providedAddress, topics, fromBlock, toBlock) {
        expect(providedAddress).toEqual(address)
        expect(topics).toEqual([
          [
            abi.getEventTopic('RoleGranted'),
            abi.getEventTopic('RoleRevoked'),
            abi.getEventTopic('RoleAdminChanged'),
            abi.getEventTopic('GrantAccess'),
            abi.getEventTopic('RevokeAccess'),
          ],
        ])
        expect(fromBlock).toEqual(0)
        expect(toBlock).toEqual(BLOCK_NUMBER)
        return []
      },
    })

    const handler = new ScrollAccessControlHandler(
      'someName',
      {
        type: 'scrollAccessControl',
      },
      [],
      DiscoveryLogger.SILENT,
    )
    const value = await handler.execute(provider, address, BLOCK_NUMBER)
    expect(value).toEqual({
      field: 'someName',
      value: {
        roles: {
          DEFAULT_ADMIN_ROLE: {
            adminRole: 'DEFAULT_ADMIN_ROLE',
            members: [],
          },
        },
        targets: {},
      },
      ignoreRelative: undefined,
    })
  })

  it('many logs', async () => {
    const WIZARD_ROLE = utils.solidityKeccak256(['string'], ['WIZARD_ROLE'])
    const WARRIOR_ROLE = utils.solidityKeccak256(['string'], ['WARRIOR_ROLE'])
    const ROGUE_ROLE = utils.solidityKeccak256(['string'], ['ROGUE_ROLE'])
    const GOBLIN_ROLE = utils.solidityKeccak256(['string'], ['GOBLIN_ROLE'])
    const DEFAULT_ADMIN_ROLE = '0x' + '0'.repeat(64)

    const Alice = EthereumAddress.random()
    const Bob = EthereumAddress.random()
    const Charlie = EthereumAddress.random()

    const ContractA = EthereumAddress.random()
    const ContractB = EthereumAddress.random()
    const ContractC = EthereumAddress.random()

    const address = EthereumAddress.random()
    const provider = mockObject<DiscoveryProvider>({
      async getLogs() {
        return [
          RoleGranted(WARRIOR_ROLE, Alice),
          RoleGranted(WARRIOR_ROLE, Bob),
          RoleRevoked(WARRIOR_ROLE, Alice),
          RoleAdminChanged(WARRIOR_ROLE, WIZARD_ROLE),
          RoleAdminChanged(DEFAULT_ADMIN_ROLE, GOBLIN_ROLE),
          RoleAdminChanged(DEFAULT_ADMIN_ROLE, ROGUE_ROLE),
          RoleGranted(WIZARD_ROLE, Charlie),
          RoleGranted(ROGUE_ROLE, Alice),
          RoleGranted(DEFAULT_ADMIN_ROLE, Bob),
          RoleGranted(DEFAULT_ADMIN_ROLE, Bob),
          RoleRevoked(GOBLIN_ROLE, Charlie),
          RoleGranted(GOBLIN_ROLE, Charlie),
          RoleGranted(WARRIOR_ROLE, Charlie),
          RoleGranted(WARRIOR_ROLE, Alice),
          RoleAdminChanged(ROGUE_ROLE, GOBLIN_ROLE),
          GrantAccess(WIZARD_ROLE, ContractA, ['0x99372321']),
          GrantAccess(ROGUE_ROLE, ContractA, ['0x99372321']),
          GrantAccess(WIZARD_ROLE, ContractA, ['0x625ba713']),
          GrantAccess(WARRIOR_ROLE, ContractB, ['0x99372321']),
          GrantAccess(WARRIOR_ROLE, ContractB, ['0x625ba713']),
          GrantAccess(GOBLIN_ROLE, ContractB, ['0x99372321']),
          GrantAccess(GOBLIN_ROLE, ContractB, ['0x625ba713']),
          GrantAccess(WARRIOR_ROLE, ContractA, ['0x99372321']),
          GrantAccess(GOBLIN_ROLE, ContractA, ['0x99372321']),
          GrantAccess(GOBLIN_ROLE, ContractC, ['0x99372321']),
          RevokeAccess(GOBLIN_ROLE, ContractB, ['0x99372321']),
          RevokeAccess(GOBLIN_ROLE, ContractB, ['0x625ba713']),
          RevokeAccess(WARRIOR_ROLE, ContractA, ['0x99372321']),
          RevokeAccess(GOBLIN_ROLE, ContractA, ['0x99372321']),
          RevokeAccess(GOBLIN_ROLE, ContractC, ['0x99372321']),
        ]
      },
      getStorage: mockFn().resolvesTo(Bytes.fromHex('0'.repeat(88))),
      call: mockFn().resolvesTo(Bytes.fromHex('0'.repeat(88))),
      getMetadata: mockFn().resolvesTo({
        name: 'name',
        isVerified: true,
        abi: ['function test(bytes32 id)', 'function testSecond(bytes32 id)'],
        source: 'name',
      }),
    })

    const handler = new ScrollAccessControlHandler(
      'someName',
      {
        type: 'scrollAccessControl',
        roleNames: { [WIZARD_ROLE]: 'WIZARD_ROLE' },
      },
      [
        'function WARRIOR_ROLE() view returns (bytes32)',
        'function ROGUE_ROLE() view returns (bytes32)',
      ],
      DiscoveryLogger.SILENT,
    )
    const value = await handler.execute(provider, address, BLOCK_NUMBER)
    expect(value).toEqual({
      field: 'someName',
      value: {
        roles: {
          DEFAULT_ADMIN_ROLE: {
            adminRole: 'ROGUE_ROLE',
            members: [Bob.toString()],
          },
          WARRIOR_ROLE: {
            adminRole: 'WIZARD_ROLE',
            members: [Bob.toString(), Charlie.toString(), Alice.toString()],
          },
          WIZARD_ROLE: {
            adminRole: 'DEFAULT_ADMIN_ROLE',
            members: [Charlie.toString()],
          },
          ROGUE_ROLE: {
            adminRole: GOBLIN_ROLE,
            members: [Alice.toString()],
          },
          [GOBLIN_ROLE]: {
            adminRole: 'DEFAULT_ADMIN_ROLE',
            members: [Charlie.toString()],
          },
        },
        targets: {
          [ContractA.toString()]: {
            'test(bytes32)': ['WIZARD_ROLE', 'ROGUE_ROLE'],
            'testSecond(bytes32)': ['WIZARD_ROLE'],
          },
          [ContractB.toString()]: {
            'test(bytes32)': ['WARRIOR_ROLE'],
            'testSecond(bytes32)': ['WARRIOR_ROLE'],
          },
        },
      },
      ignoreRelative: undefined,
    })
  })

  it('passes relative ignore', async () => {
    const address = EthereumAddress.random()
    const provider = mockObject<DiscoveryProvider>({
      async getLogs() {
        return []
      },
    })

    const handler = new ScrollAccessControlHandler(
      'someName',
      {
        type: 'scrollAccessControl',
        ignoreRelative: true,
      },
      [],
      DiscoveryLogger.SILENT,
    )
    const value = await handler.execute(provider, address, BLOCK_NUMBER)
    expect(value).toEqual({
      field: 'someName',
      value: {
        roles: {
          DEFAULT_ADMIN_ROLE: {
            adminRole: 'DEFAULT_ADMIN_ROLE',
            members: [],
          },
        },
        targets: {},
      },
      ignoreRelative: true,
    })
  })
})
