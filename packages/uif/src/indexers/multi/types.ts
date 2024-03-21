export interface Configuration<T> {
  id: string
  properties: T
  minHeight: number
  maxHeight: number | null
}

export interface UpdateConfiguration<T> extends Configuration<T> {
  hasData: boolean
}

export interface SavedConfiguration<T> {
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
