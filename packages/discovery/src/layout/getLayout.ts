import { LayoutItem } from './LayoutItem'
import { SolidityStorageLayout } from './SolidityStorageLayout'

export function getLayout(output: SolidityStorageLayout): LayoutItem[] {
  console.log(JSON.stringify(output, null, 2))
  return []
}
