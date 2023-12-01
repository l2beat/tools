import { cloneDeep, zip } from 'lodash'

import { SlotVariable, SlotView } from './SlotView'

export function mergeFlatLayouts(layouts: SlotView[][]): SlotView[] {
  return layouts.reduce((a, b) => mergeTwoLayouts(cloneDeep(a), b))
}

function mergeTwoLayouts(a: SlotView[], b: SlotView[]): SlotView[] {
  for (const item of b) {
    const existing = a.find((x) => isEqual(x, item))
    if (!existing) {
      a.push(item)
    } else {
      if (
        existing.kind !== 'static composite' &&
        item.kind !== 'static composite'
      ) {
        addAlias(existing.variable, item.variable.name)
      }
      if (
        existing.kind === 'static composite' &&
        item.kind === 'static composite'
      ) {
        for (const [i, variable] of existing.variables.entries()) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          addAlias(variable, item.variables[i]!.name)
        }
      }
      if (existing.kind === 'dynamic array' && item.kind === 'dynamic array') {
        existing.itemView = mergeTwoLayouts(existing.itemView, item.itemView)
      }
      if (
        existing.kind === 'dynamic mapping' &&
        item.kind === 'dynamic mapping'
      ) {
        existing.valueView = mergeTwoLayouts(existing.valueView, item.valueView)
      }
    }
  }
  return a.sort((a, b) => a.slot - b.slot)
}

function isEqual(a: SlotView, b: SlotView): boolean {
  if (
    a.kind !== b.kind ||
    a.slot !== b.slot ||
    a.path.join('.') !== b.path.join('.')
  ) {
    return false
  }
  if (
    (a.kind === 'static single' && b.kind === 'static single') ||
    (a.kind === 'dynamic bytes' && b.kind === 'dynamic bytes')
  ) {
    return variableEquals(a.variable, b.variable)
  }
  if (a.kind === 'static composite' && b.kind === 'static composite') {
    return zip(a.variables, b.variables).every(
      ([x, y]) => x && y && variableEquals(x, y),
    )
  }
  if (a.kind === 'dynamic array' && b.kind === 'dynamic array') {
    return (
      variableEquals(a.variable, b.variable) &&
      a.itemView.length === b.itemView.length
    )
  }
  if (a.kind === 'dynamic mapping' && b.kind === 'dynamic mapping') {
    return variableEquals(a.variable, b.variable) && a.keyType === b.keyType
  }
  return false
}

function variableEquals(a: SlotVariable, b: SlotVariable): boolean {
  return a.offset === b.offset && a.size === b.size && a.type === b.type
}

function addAlias(variable: SlotVariable, name: string): void {
  if (variable.name !== name && !variable.aliases.includes(name)) {
    variable.aliases.push(name)
  }
}
