export interface Configuration<T> {
  id: string
  properties: T
  minHeight: number
  maxHeight: number | null
}

export interface UpdateConfiguration<T> {
  id: string
  properties: T
  minHeight: number
  maxHeight: number | null
  hasData: boolean
}

export interface SavedConfiguration<T> {
  id: string
  properties: T
  minHeight: number
  // TODO: add maxHeight
  // TODO: add null, save configurations without syncing
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
