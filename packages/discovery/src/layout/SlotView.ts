export type SlotView =
  | SingleSlotView
  | CompositeSlotView
  | BytesSlotView
  | MappingSlotView
  | ArraySlotView

export interface SingleSlotView {
  kind: 'static single'
  path: string[]
  slot: number
  variable: SlotVariable
}

export interface CompositeSlotView {
  kind: 'static composite'
  path: string[]
  slot: number
  variables: SlotVariable[]
}

export interface BytesSlotView {
  kind: 'dynamic bytes'
  path: string[]
  slot: number
  variable: SlotVariable
}

export interface MappingSlotView {
  kind: 'dynamic mapping'
  path: string[]
  slot: number
  variable: SlotVariable
  keyType: string
  valueView: SlotView[]
}

export interface ArraySlotView {
  kind: 'dynamic array'
  path: string[]
  slot: number
  variable: SlotVariable
  itemView: SlotView[]
}

export interface SlotVariable {
  name: string
  aliases: string[]
  type: string
  offset: number
  size: number
}
