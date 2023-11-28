import { AnonymousItem, LayoutItem } from './LayoutItem'
import {
  SolidityStorageEntry,
  SolidityStorageLayout,
  SolidityTypeEntry,
} from './SolidityStorageLayout'

const MAX_DEPTH = 10

export function getLayout(output: SolidityStorageLayout): LayoutItem[] {
  return output.storage.map((item) => parseEntry(item, output.types ?? {}, 0))
}

function parseEntry(
  item: SolidityStorageEntry,
  types: Record<string, SolidityTypeEntry>,
  depth: number,
): LayoutItem {
  return {
    name: item.label,
    slot: parseInt(item.slot, 10),
    offset: item.offset,
    ...parseType(item.type, types, depth),
  }
}

function parseType(
  typeKey: string,
  types: Record<string, SolidityTypeEntry>,
  depth: number,
): AnonymousItem {
  const type = types[typeKey]
  if (!type) {
    throw new Error(`Unknown type: ${typeKey}`)
  }

  const typeBase = {
    type: type.label,
    size: parseInt(type.numberOfBytes, 10),
  }

  if (depth >= MAX_DEPTH) {
    return {
      kind: 'static',
      ...typeBase,
      type: 'Error: Maximum depth exceeded',
    }
  }

  if (type.encoding === 'inplace' && !type.base && !type.members) {
    return { kind: 'static', ...typeBase }
  }

  if (type.encoding === 'inplace' && type.members) {
    return {
      kind: 'struct',
      ...typeBase,
      children: type.members.map((member) =>
        parseEntry(member, types, depth + 1),
      ),
    }
  }

  if (type.encoding === 'inplace' && type.base) {
    const item = parseType(type.base, types, depth + 1)
    return {
      kind: 'static array',
      ...typeBase,
      length: parseInt(type.numberOfBytes, 10) / item.size,
      item,
    }
  }

  if (type.encoding === 'dynamic_array' && type.base) {
    return {
      kind: 'dynamic array',
      ...typeBase,
      item: parseType(type.base, types, depth + 1),
    }
  }

  if (type.encoding === 'mapping' && type.key && type.value) {
    return {
      kind: 'mapping',
      ...typeBase,
      key: parseType(type.key, types, depth + 1),
      value: parseType(type.value, types, depth + 1),
    }
  }

  if (type.encoding === 'bytes') {
    return {
      kind: 'dynamic bytes',
      ...typeBase,
    }
  }

  throw new Error('Invalid type')
}
