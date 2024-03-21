export interface Configuration<T> {
  id: string
  properties: T
  minHeight: number
  maxHeight: number | null
}

export interface StoredConfiguration<T> {
  id: string
  properties: T
  minHeight: number
  currentHeight: number
}

export interface RemovalConfiguration<T> {
  id: string
  properties: T
  fromHeightInclusive: number
  toHeightInclusive: number
}

export interface ConfigurationRange<T> {
  from: number
  to: number
  configurations: Configuration<T>[]
}
