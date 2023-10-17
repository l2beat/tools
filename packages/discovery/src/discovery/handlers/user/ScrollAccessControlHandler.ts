import { providers, utils } from 'ethers'
import * as z from 'zod'

import { EthereumAddress } from '../../../utils/EthereumAddress'
import { DiscoveryLogger } from '../../DiscoveryLogger'
import { DiscoveryProvider } from '../../provider/DiscoveryProvider'
import { Handler, HandlerResult } from '../Handler'
import { assert } from '@l2beat/backend-tools'

export type ScrollAccessControlHandlerDefinition = z.infer<
  typeof ScrollAccessControlHandlerDefinition
>
export const ScrollAccessControlHandlerDefinition = z.strictObject({
  type: z.literal('scrollAccessControl'),
  roleNames: z.optional(
    z.record(z.string().regex(/^0x[a-f\d]{64}$/i), z.string()),
  ),
  ignoreRelative: z.optional(z.boolean()),
})

const abi = new utils.Interface([
  'event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)',
  'event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)',
  'event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)',
  'event GrantAccess(bytes32 indexed role, address indexed target, bytes4[] selectors)',
  'event RevokeAccess(bytes32 indexed role, address indexed target, bytes4[] selectors)',
])

export class ScrollAccessControlHandler implements Handler {
  readonly dependencies: string[] = []
  private readonly knownNames = new Map<string, string>()

  constructor(
    readonly field: string,
    readonly definition: ScrollAccessControlHandlerDefinition,
    abi: string[],
    readonly logger: DiscoveryLogger,
  ) {
    this.knownNames.set('0x' + '0'.repeat(64), 'DEFAULT_ADMIN_ROLE')
    for (const [hash, name] of Object.entries(definition.roleNames ?? {})) {
      this.knownNames.set(hash, name)
    }
    for (const entry of abi) {
      const name = entry.match(/^function (\w+)_ROLE\(\)/)?.[1]
      if (name) {
        const fullName = name + '_ROLE'
        const hash = utils.solidityKeccak256(['string'], [fullName])
        this.knownNames.set(hash, fullName)
      }
    }
  }

  private getRoleName(role: string): string {
    return this.knownNames.get(role) ?? role
  }

  async execute(
    provider: DiscoveryProvider,
    address: EthereumAddress,
    blockNumber: number,
  ): Promise<HandlerResult> {
    this.logger.logExecution(this.field, ['Checking ScrollAccessControl'])
    const logs = await provider.getLogs(
      address,
      [
        [
          abi.getEventTopic('RoleGranted'),
          abi.getEventTopic('RoleRevoked'),
          abi.getEventTopic('RoleAdminChanged'),
          abi.getEventTopic('GrantAccess'),
          abi.getEventTopic('RevokeAccess'),
        ],
      ],
      0,
      blockNumber,
    )

    const roles: Record<
      string,
      {
        adminRole: string
        members: Set<EthereumAddress>
      }
    > = {}
    const targets: Record<string, Record<string, Set<string>>> = {}

    getRole('DEFAULT_ADMIN_ROLE')

    function getRole(role: string): {
      adminRole: string
      members: Set<EthereumAddress>
    } {
      const value = roles[role] ?? {
        adminRole: 'DEFAULT_ADMIN_ROLE',
        members: new Set(),
      }
      roles[role] = value
      return value
    }

    function getTarget(target: string): Record<string, Set<string>> {
      const value = targets[target] ?? {}
      targets[target] = value
      return value
    }

    function getSelector(target: Record<string, Set<string>>, selector: string): Set<string> {
      const value = target[selector] ?? new Set()
      target[selector] = value
      return value
    }

    async function decodeSelectors(
      target: EthereumAddress,
      encodedSelectors: string[],
    ): Promise<string[]> {
      const metadata = await provider.getMetadata(target)
      const iface = new utils.Interface(metadata.abi)
      const abiSelectors = Object.entries(iface.functions).map(
        ([functionName, fragment]) => [
          functionName,
          iface.getSighash(fragment),
        ],
      )

      return encodedSelectors.map((s) => {
        const decoded = abiSelectors.find(
          ([_, abiSelector]) => abiSelector === s,
        )
        if (decoded) {
          assert(decoded[0])
          return decoded[0]
        }
        return s
      })
    }

    for (const log of logs) {
      const parsed = parseRoleLog(log)
      const role = getRole(this.getRoleName(parsed.role))
      if (parsed.type === 'RoleAdminChanged') {
        role.adminRole = this.getRoleName(parsed.adminRole)
      } else if (parsed.type === 'RoleGranted') {
        role.members.add(parsed.account)
      } else if (parsed.type === 'RoleRevoked') {
        role.members.delete(parsed.account)
      } else if (parsed.type === 'GrantAccess') {
        const target = getTarget(parsed.target.toString())
        parsed.selectors.forEach((s) => {
            if(target[s] === undefined) {
                target[s] = new Set()
            }
        })
        parsed.selectors.forEach((s) => getSelector(target, s).add(parsed.role))
      } else if (parsed.type === 'RevokeAccess') {
        const target = getTarget(parsed.target.toString())
        parsed.selectors.forEach((s) => delete target[s])
      }
    }

    return {
      field: this.field,
      value: {
        roles: Object.fromEntries(
          Object.entries(roles).map(([role, config]) => [
            role,
            {
              adminRole: config.adminRole,
              members: [...config.members].map((x) => x.toString()),
            },
          ]),
        ),
        targets: Object.fromEntries(
          Object.entries(targets).map(([target, selectors]) => [
            target,
            Object.fromEntries(Object.entries(selectors).map(([selector, roles]) => [
                selector, [...roles]
            ]))
          ]),
        ),
      },
      ignoreRelative: this.definition.ignoreRelative,
    }
  }
}

function parseRoleLog(log: providers.Log):
  | {
      readonly type: 'RoleGranted' | 'RoleRevoked'
      readonly role: string
      readonly account: EthereumAddress
      readonly adminRole?: undefined
    }
  | {
      readonly type: 'RoleAdminChanged'
      readonly role: string
      readonly adminRole: string
      readonly account?: undefined
    }
  | {
      readonly type: 'GrantAccess' | 'RevokeAccess'
      readonly role: string
      readonly target: EthereumAddress
      readonly selectors: string[]
    } {
  const event = abi.parseLog(log)
  if (event.name === 'RoleGranted' || event.name === 'RoleRevoked') {
    return {
      type: event.name,
      role: event.args.role as string,
      account: EthereumAddress(event.args.account as string),
    } as const
  }
  if (event.name === 'GrantAccess' || event.name === 'RevokeAccess') {
    return {
      type: event.name,
      role: event.args.role as string,
      target: EthereumAddress(event.args.target as string),
      selectors: event.args.selectors as string[],
    } as const
  }

  return {
    type: 'RoleAdminChanged',
    role: event.args.role as string,
    adminRole: event.args.newAdminRole as string,
  } as const
}
