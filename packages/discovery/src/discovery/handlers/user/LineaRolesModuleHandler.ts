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

type ExecutionOptions = 'None' | 'Send' | 'DelegateCall' | 'Both'
type ParameterType = 'Static' | 'Dynamic' | 'Dynamic32'
type ComparisonType = 'EqualTo' | 'GreaterThan' | 'LessThan' | 'OneOf'

interface TargetAddress {
  clearance: 'None' | 'Target' | 'Function'
  options: ExecutionOptions
}

interface ParameterConfig {
  isScoped: boolean
  type: ParameterType
  comparisonType: ComparisonType
}

interface ScopeConfig {
  options: ExecutionOptions
  wildcarded: boolean
  parameters: ParameterConfig[]
}

interface Role {
  members: Record<string, boolean>
  targets: Record<string, TargetAddress>
  functions: Record<string, Record<string, ScopeConfig>>
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
    const events = logs.map(parseRoleLog)
    const roles: Record<number, Role> = {}

    // TODO(radomski): This should be moved to a class this will handle the
    // selector decoding logic. This will be done together with L2B-2940.
    const targets = [...new Set(events.map((e) => e.targetAddress))]
    const proxyDetector = new ProxyDetector(provider, DiscoveryLogger.SILENT)
    const implementations: Record<string, EthereumAddress[]> = {}
    const contractMetadata: Record<string, ContractMetadata> = {}
    await Promise.all(
      [...targets].map(async (address) => {
        const proxy = await proxyDetector.detectProxy(address, blockNumber)
        if (proxy) {
          implementations[address.toString()] = proxy.implementations
        }
      }),
    )
    const implementationContracts = new Set<EthereumAddress>(
      Object.values(implementations).flat(),
    )
    await Promise.all(
      [...targets, ...implementationContracts].map(async (address) => {
        contractMetadata[address.toString()] =
          await provider.getMetadata(address)
      }),
    )

    function decodeSelector(target: EthereumAddress, selector: string): string {
      const metadata = contractMetadata[target.toString()]
      if (metadata === undefined) {
        return selector
      }

      const iface = new utils.Interface(metadata.abi)
      const abiSelectors = Object.entries(iface.functions).map(
        ([functionName, fragment]) => [
          functionName,
          iface.getSighash(fragment),
        ],
      )

      const decoded = abiSelectors.find(
        ([_, abiSelector]) => abiSelector === selector,
      )
      if (decoded) {
        assert(decoded[0])
        return decoded[0]
      }
      return selector
    }

    for (const event of events) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      roles[event.role] ??= {
        members: {},
        targets: {},
        functions: {},
        compValues: {},
        compValuesOneOf: {},
      }

      const role = roles[event.role]
      assert(role !== undefined)

      switch (event.type) {
        case 'AllowTarget': {
          role.targets[event.targetAddress.toString()] = {
            clearance: 'Target',
            options: event.execOption,
          }
          break
        }
        case 'RevokeTarget': {
          role.targets[event.targetAddress.toString()] = {
            clearance: 'None',
            options: 'None',
          }
          break
        }
        case 'ScopeTarget': {
          role.targets[event.targetAddress.toString()] = {
            clearance: 'Function',
            options: 'None',
          }
          break
        }
        case 'ScopeAllowFunction':
        case 'ScopeFunctionExecutionOptions':
        case 'UnscopeParameter': {
          const func = getFunction(role, event)
          func[decodeSelector(event.targetAddress, event.functionSig)] =
            decodeScopeConfig(event.resultingScopeConfig)
          break
        }
        case 'ScopeRevokeFunction': {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete role.functions[event.targetAddress.toString()]
          break
        }
        case 'ScopeFunction': {
          const func = getFunction(role, event)
          func[decodeSelector(event.targetAddress, event.functionSig)] =
            decodeScopeConfig(event.resultingScopeConfig)

          event.compValue.forEach((compValue, i) => {
            role.compValues[compValueKey(event, i)] = compValue
          })
          break
        }
        case 'ScopeParameter': {
          const func = getFunction(role, event)
          func[decodeSelector(event.targetAddress, event.functionSig)] =
            decodeScopeConfig(event.resultingScopeConfig)
          role.compValues[compValueKey(event, event.index)] = event.compValue
          break
        }
        case 'ScopeParameterAsOneOf': {
          const func = getFunction(role, event)
          func[decodeSelector(event.targetAddress, event.functionSig)] =
            decodeScopeConfig(event.resultingScopeConfig)
          role.compValuesOneOf[compValueKey(event, event.index)] =
            event.compValues
          break
        }
        default: {
          break
        }
      }
    }

    return {
      field: this.field,
      value: Object.fromEntries(
        Object.entries(roles).map(([key, role]) => [
          key,
          {
            members: role.members,
            targets: Object.fromEntries(
              Object.entries(role.targets).map(([addr, opt]) => [
                addr,
                { ...opt },
              ]),
            ),
            functions: Object.fromEntries(
              Object.entries(role.functions).map(([addr, config]) => [
                addr,
                Object.fromEntries(
                  Object.entries(config).map(([selector, scopeConfig]) => [
                    selector,
                    Object.fromEntries(Object.entries(scopeConfig)),
                  ]),
                ),
              ]),
            ),
            compValues: role.compValues,
            compValuesOneOf: role.compValuesOneOf,
          },
        ]),
      ),
      ignoreRelative: this.definition.ignoreRelative,
    }
  }
}

function decodeScopeConfig(configStr: string): ScopeConfig {
  const config = BigInt(configStr)
  const leftSide = config >> 240n
  const options = (leftSide & 0xc000n) >> 14n
  const isWildcarded = (leftSide & 0x2000n) >> 13n
  const length = leftSide & 0xffn

  const parameters: ParameterConfig[] = new Array(Number(length)).map(
    (_, i) => ({
      isScoped: maskOffIsScoped(config, i) !== 0,
      type: decodeParameterType(maskOffParameterType(config, i)),
      comparisonType: decodeComparisonType(maskOffComparisonType(config, i)),
    }),
  )

  return {
    options: decodeExecOptions(Number(options)),
    wildcarded: isWildcarded !== 0n,
    parameters,
  }
}

function maskOffIsScoped(config: bigint, index: number): number {
  return Number((1n << (BigInt(index) + 192n)) & config)
}

function maskOffParameterType(config: bigint, index: number): number {
  return Number((3n << (BigInt(index) * 2n + 96n)) & config)
}

function maskOffComparisonType(config: bigint, index: number): number {
  return Number((3n << (BigInt(index) * 2n)) & config)
}

function getFunction(
  role: Role,
  arg: Pick<ScopeAllowFunctionLog, 'targetAddress' | 'functionSig'>,
): Record<string, ScopeConfig> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  role.functions[arg.targetAddress.toString()] ??= {}
  const func = role.functions[arg.targetAddress.toString()]
  assert(func !== undefined)
  return func
}

function compValueKey(
  arg: Pick<ScopeAllowFunctionLog, 'targetAddress' | 'functionSig'>,
  index: number,
): string {
  return `${arg.targetAddress.toString()}:${arg.functionSig}:${index}`
}

function decodeExecOptions(value: number): TargetAddress['options'] {
  const lookup: Record<number, TargetAddress['options']> = {
    0: 'None',
    1: 'Send',
    2: 'DelegateCall',
    3: 'Both',
  }

  const result = lookup[value]
  assert(result !== undefined, 'Invalid execOption value')
  return result
}

function decodeParameterType(value: number): ParameterType {
  const lookup: Record<number, ParameterType> = {
    0: 'Static',
    1: 'Dynamic',
    2: 'Dynamic32',
  }

  const result = lookup[value]
  assert(result !== undefined, 'Invalid parameterType value')
  return result
}

function decodeComparisonType(value: number): ComparisonType {
  const lookup: Record<number, ComparisonType> = {
    0: 'EqualTo',
    1: 'GreaterThan',
    2: 'LessThan',
    3: 'OneOf',
  }

  const result = lookup[value]
  assert(result !== undefined, 'Invalid comparisontype value')
  return result
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
