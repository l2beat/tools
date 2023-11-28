export type LayoutItem =
  | StaticItem
  | StructItem
  | StaticArrayItem
  | DynamicArrayItem
  | MappingItem
  | DynamicBytesItem

export type AnonymousItem =
  | Anonymize<StaticItem>
  | Anonymize<StructItem>
  | Anonymize<StaticArrayItem>
  | Anonymize<DynamicArrayItem>
  | Anonymize<MappingItem>
  | Anonymize<DynamicBytesItem>

type Anonymize<T> = Omit<T, 'name' | 'slot' | 'offset'>

export interface StaticItem {
  name: string
  kind: 'static'
  type: string
  slot: number
  offset: number
  size: number
}

export interface StructItem {
  name: string
  kind: 'struct'
  type: string
  slot: number
  offset: number
  size: number
  children: LayoutItem[]
}

export interface StaticArrayItem {
  name: string
  kind: 'static array'
  type: string
  slot: number
  offset: number
  size: number
  length: number
  item: AnonymousItem
}

export interface DynamicArrayItem {
  name: string
  kind: 'dynamic array'
  type: string
  slot: number
  offset: 0
  size: 32
  item: AnonymousItem
}

export interface MappingItem {
  name: string
  kind: 'mapping'
  type: string
  slot: number
  offset: 0
  size: 32
  key: AnonymousItem
  value: AnonymousItem
}

export interface DynamicBytesItem {
  name: string
  kind: 'dynamic bytes'
  type: string
  slot: number
  offset: 0
  size: 32
}
