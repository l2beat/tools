import { assert } from '@l2beat/backend-tools'
import { BigNumber, providers, utils } from 'ethers'
import * as z from 'zod'

import { EthereumAddress } from '../../../utils/EthereumAddress'
import { DiscoveryLogger } from '../../DiscoveryLogger'
import {
  ContractMetadata,
  DiscoveryProvider,
} from '../../provider/DiscoveryProvider'
import { ProxyDetector } from '../../proxies/ProxyDetector'
import { ClassicHandler, HandlerResult } from '../Handler'
import { solidityPack } from 'ethers/lib/utils'
import { zip } from 'lodash'

export type LineaRolesModuleHandlerDefinition = z.infer<
  typeof LineaRolesModuleHandlerDefinition
>
export const LineaRolesModuleHandlerDefinition = z.strictObject({
  type: z.literal('lineaRolesModule'),
  roleNames: z.optional(
    z.record(z.string().regex(/^0x[a-f\d]{64}$/i), z.string()),
  ),
  ignoreRelative: z.optional(z.boolean()),
})

const abi = new utils.Interface([
  'event AllowTarget(uint16 role, address targetAddress, uint8 options)',
  'event RevokeTarget(uint16 role, address targetAddress)',
  'event ScopeTarget(uint16 role, address targetAddress)',
  'event ScopeAllowFunction(uint16 role, address targetAddress, bytes4 selector, uint8 options, uint256 resultingScopeConfig)',
  'event ScopeRevokeFunction(uint16 role, address targetAddress, bytes4 selector, uint256 resultingScopeConfig)',
  'event ScopeFunction(uint16 role, address targetAddress, bytes4 functionSig, bool[] isParamScoped, uint8[] paramType, uint8[] paramComp, bytes[] compValue, uint8 options, uint256 resultingScopeConfig)',
  'event ScopeFunctionExecutionOptions(uint16 role, address targetAddress, bytes4 functionSig, uint8 options, uint256 resultingScopeConfig)',
  'event ScopeParameter(uint16 role, address targetAddress, bytes4 functionSig, uint256 index, uint8 paramType, uint8 paramComp, bytes compValue, uint256 resultingScopeConfig)',
  'event ScopeParameterAsOneOf(uint16 role, address targetAddress, bytes4 functionSig, uint256 index, uint8 paramType, bytes[] compValues, uint256 resultingScopeConfig)',
  'event UnscopeParameter(uint16 role, address targetAddress, bytes4 functionSig, uint256 index, uint256 resultingScopeConfig)',
])

interface TargetAddress {
  clearance: 'None' | "Target" | "Function"
  options: "None" | "Send" | "DelegateCall" | "Both"
}

interface Role {
  members: Record<string, boolean>
  targets: Record<string, TargetAddress>
  functions: Record<string, string>
  compValues: Record<string, string>
  compValuesOneOf: Record<string, string[]>
}

export class LineaRolesModuleHandler implements ClassicHandler {
  readonly dependencies: string[] = []

  constructor(
    readonly field: string,
    readonly definition: LineaRolesModuleHandlerDefinition,
    readonly abi: string[],
    readonly logger: DiscoveryLogger,
  ) {}

  async execute(
    provider: DiscoveryProvider,
    address: EthereumAddress,
    blockNumber: number,
  ): Promise<HandlerResult> {
    this.logger.logExecution(this.field, ['Checking LineaRolesModule'])
    const logs = await provider.getLogs(
      address,
      [
        [
          abi.getEventTopic('AllowTarget'),
          abi.getEventTopic('RevokeTarget'),
          abi.getEventTopic('ScopeTarget'),
          abi.getEventTopic('ScopeAllowFunction'),
          abi.getEventTopic('ScopeRevokeFunction'),
          abi.getEventTopic('ScopeFunction'),
          abi.getEventTopic('ScopeFunctionExecutionOptions'),
          abi.getEventTopic('ScopeParameter'),
          abi.getEventTopic('ScopeParameterAsOneOf'),
          abi.getEventTopic('UnscopeParameter'),
        ],
      ],
      0,
      blockNumber,
    )

    const roles: Record<number, Role> = {}

    for (const log of logs) {
      const result = parseRoleLog(log)

      roles[result.role] ??= {
        members: {},
        targets: {},
        functions: {},
        compValues: {},
        compValuesOneOf: {},
      }

      switch (result.type) {
        case 'AllowTarget': {
          roles[result.role]!.targets[result.targetAddress.toString()] = {
            clearance: 'Target',
            options: result.execOption,
          }
          break
        }
        case 'RevokeTarget': {
          roles[result.role]!.targets[result.targetAddress.toString()] = {
            clearance: 'None',
            options: 'None',
          }
          break
        }
        case 'ScopeTarget': {
          roles[result.role]!.targets[result.targetAddress.toString()] = {
            clearance: 'Function',
            options: 'None',
          }
          break
        }
        case 'ScopeAllowFunction': {
          const key = functionKey(result)
          roles[result.role]!.functions[key] = result.resultingScopeConfig
          break
        }
        case 'ScopeRevokeFunction': {
          const key = functionKey(result)
          delete roles[result.role]!.functions[key]
          break
        }
        case 'ScopeFunction': {
          const key = functionKey(result)
          roles[result.role]!.functions[key] = result.resultingScopeConfig
          result.compValue.forEach((compValue, i) => {
            roles[result.role]!.compValues[compValueKey(result, i)] = compValue
          })
          break
        }
        case 'ScopeFunctionExecutionOptions': {
          const key = functionKey(result)
          roles[result.role]!.functions[key] = result.resultingScopeConfig
          break
        }
        case 'ScopeParameter': {
          const key = functionKey(result)
          roles[result.role]!.functions[key] = result.resultingScopeConfig
          roles[result.role]!.compValues[compValueKey(result, result.index)] =
            result.compValue
          break
        }
        case 'ScopeParameterAsOneOf': {
          const key = functionKey(result)
          roles[result.role]!.functions[key] = result.resultingScopeConfig
          roles[result.role]!.compValuesOneOf[
            compValueKey(result, result.index)
          ] = result.compValues
          break
        }
        case 'UnscopeParameter': {
          const key = functionKey(result)
          roles[result.role]!.functions[key] = result.resultingScopeConfig
          break
        }
        default: {
          break
        }
      }
    }

    return {
      field: this.field,
      value: Object.fromEntries(Object.entries(roles).map(([key, role]) => [key, {
          members: role.members,
          targets: Object.fromEntries(Object.entries(role.targets).map(([addr, opt]) => [addr, {...opt}])),
          functions: role.functions,
          compValues: role.compValues,
          compValuesOneOf: role.compValuesOneOf,
      }])),
      ignoreRelative: this.definition.ignoreRelative,
    }
  }
}

function functionKey(
  arg: Pick<ScopeAllowFunctionLog, 'targetAddress' | 'functionSig'>,
): string {
    return `${arg.targetAddress.toString()}:${arg.functionSig}`
}

function compValueKey(
  arg: Pick<ScopeAllowFunctionLog, 'targetAddress' | 'functionSig'>,
  index: number,
): string {
  return `${arg.targetAddress}:${arg.functionSig}:${index}`
}

function decodeExecOptions(value: number): TargetAddress['options'] {
    switch(value) {
        case 0: { return 'None' }
        case 1: { return 'Send' }
        case 2: { return 'DelegateCall' }
        case 3: { return 'Both' }
        default: {
            assert(false && "Invalid execOption value")
        }
    }
}

interface AllowTargetLog {
  readonly type: 'AllowTarget'
  readonly role: number
  readonly targetAddress: EthereumAddress
  readonly execOption: TargetAddress['options']
}

interface RevokeTargetLog {
  readonly type: 'RevokeTarget'
  readonly role: number
  readonly targetAddress: EthereumAddress
}

interface ScopeTargetLog {
  readonly type: 'ScopeTarget'
  readonly role: number
  readonly targetAddress: EthereumAddress
}

interface ScopeAllowFunctionLog {
  readonly type: 'ScopeAllowFunction'
  readonly role: number
  readonly targetAddress: EthereumAddress
  readonly functionSig: string
  readonly options: number
  readonly resultingScopeConfig: string
}

interface ScopeRevokeFunctionLog {
  readonly type: 'ScopeRevokeFunction'
  readonly role: number
  readonly targetAddress: EthereumAddress
  readonly functionSig: string
  readonly resultingScopeConfig: string
}

interface ScopeFunctionLog {
  readonly type: 'ScopeFunction'
  readonly role: number
  readonly targetAddress: EthereumAddress
  readonly functionSig: string
  readonly isParamScoped: boolean[]
  readonly paramType: number[]
  readonly paramComp: number[]
  readonly compValue: string[]
  readonly options: number
  readonly resultingScopeConfig: string
}

interface ScopeFunctionExecutionOptionsLog {
  readonly type: 'ScopeFunctionExecutionOptions'
  readonly role: number
  readonly targetAddress: EthereumAddress
  readonly functionSig: string
  readonly options: number
  readonly resultingScopeConfig: string
}

interface ScopeParameterLog {
  readonly type: 'ScopeParameter'
  readonly role: number
  readonly targetAddress: EthereumAddress
  readonly functionSig: string
  readonly index: number
  readonly paramType: number
  readonly paramComp: number
  readonly compValue: string
  readonly resultingScopeConfig: string
}

interface ScopeParameterAsOneOfLog {
  readonly type: 'ScopeParameterAsOneOf'
  readonly role: number
  readonly targetAddress: EthereumAddress
  readonly functionSig: string
  readonly index: number
  readonly paramType: number
  readonly compValues: string[]
  readonly resultingScopeConfig: string
}

interface UnscopeParameterLog {
  readonly type: 'UnscopeParameter'
  readonly role: number
  readonly targetAddress: EthereumAddress
  readonly functionSig: string
  readonly index: number
  readonly resultingScopeConfig: string
}

function parseRoleLog(
  log: providers.Log,
):
  | AllowTargetLog
  | RevokeTargetLog
  | ScopeTargetLog
  | ScopeAllowFunctionLog
  | ScopeRevokeFunctionLog
  | ScopeFunctionLog
  | ScopeFunctionExecutionOptionsLog
  | ScopeParameterLog
  | ScopeParameterAsOneOfLog
  | UnscopeParameterLog {
  const event = abi.parseLog(log)
  if (event.name === 'AllowTarget') {
    return {
      type: event.name,
      role: event.args.role as number,
      targetAddress: EthereumAddress(event.args.targetAddress as string),
      execOption: decodeExecOptions(event.args.options as number),
    } as const
  } else if (event.name === 'RevokeTarget' || event.name === 'ScopeTarget') {
    return {
      type: event.name,
      role: event.args.role as number,
      targetAddress: EthereumAddress(event.args.targetAddress as string),
    } as const
  } else if (event.name === 'ScopeAllowFunction') {
    return {
      type: event.name,
      role: event.args.role as number,
      targetAddress: EthereumAddress(event.args.targetAddress as string),
      functionSig: event.args.selector as string,
      options: event.args.options as number,
      resultingScopeConfig: (
        event.args.resultingScopeConfig as BigNumber
      ).toString(),
    } as const
  } else if (event.name === 'ScopeRevokeFunction') {
    return {
      type: event.name,
      role: event.args.role as number,
      targetAddress: EthereumAddress(event.args.targetAddress as string),
      functionSig: event.args.selector as string,
      resultingScopeConfig: (
        event.args.resultingScopeConfig as BigNumber
      ).toString(),
    } as const
  } else if (event.name === 'ScopeFunction') {
    return {
      type: event.name,
      role: event.args.role as number,
      targetAddress: EthereumAddress(event.args.targetAddress as string),
      functionSig: event.args.functionSig as string,
      isParamScoped: event.args.isParamScoped as boolean[],
      paramType: event.args.paramType as number[],
      paramComp: event.args.paramComp as number[],
      compValue: event.args.compValue as string[],
      options: event.args.options as number,
      resultingScopeConfig: (
        event.args.resultingScopeConfig as BigNumber
      ).toString(),
    } as const
  } else if (event.name === 'ScopeFunctionExecutionOptions') {
    return {
      type: event.name,
      role: event.args.role as number,
      targetAddress: EthereumAddress(event.args.targetAddress as string),
      functionSig: event.args.functionSig as string,
      options: event.args.options as number,
      resultingScopeConfig: (
        event.args.resultingScopeConfig as BigNumber
      ).toString(),
    } as const
  } else if (event.name === 'ScopeParameter') {
    return {
      type: event.name,
      role: event.args.role as number,
      targetAddress: EthereumAddress(event.args.targetAddress as string),
      functionSig: event.args.functionSig as string,
      index: event.args.index as number,
      paramType: event.args.paramType as number,
      paramComp: event.args.paramComp as number,
      compValue: event.args.compValue as string,
      resultingScopeConfig: (
        event.args.resultingScopeConfig as BigNumber
      ).toString(),
    } as const
  } else if (event.name === 'ScopeParameterAsOneOf') {
    return {
      type: event.name,
      role: event.args.role as number,
      targetAddress: EthereumAddress(event.args.targetAddress as string),
      functionSig: event.args.functionSig as string,
      index: event.args.index as number,
      paramType: event.args.paramType as number,
      compValues: event.args.compValues as string[],
      resultingScopeConfig: (
        event.args.resultingScopeConfig as BigNumber
      ).toString(),
    } as const
  } else if (event.name === 'UnscopeParameter') {
    return {
      type: event.name,
      role: event.args.role as number,
      targetAddress: EthereumAddress(event.args.targetAddress as string),
      functionSig: event.args.functionSig as string,
      index: event.args.index as number,
      resultingScopeConfig: (
        event.args.resultingScopeConfig as BigNumber
      ).toString(),
    } as const
  }

  assert(false)
}
