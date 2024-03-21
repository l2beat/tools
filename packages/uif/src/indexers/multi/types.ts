export interface Configuration<T> {
  id: string
  properties: T
  minHeight: number
  maxHeight: number | null
}

export interface SavedConfiguration {
  id: string
  minHeight: number
  currentHeight: number
}

export interface RemovalConfiguration {
  id: string
  fromHeightInclusive: number
  toHeightInclusive: number
}

export interface ConfigurationRange<T> {
  from: number
  to: number
  configurations: Configuration<T>[]
}
