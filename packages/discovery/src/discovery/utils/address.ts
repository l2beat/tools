import { Bytes } from '../../utils/bytes'
import { EthereumAddress } from '../../utils/EthereumAddress'

export function bytes32ToAddress(bytes32: Bytes): EthereumAddress {
  return EthereumAddress(bytes32.slice(12, 32).toString())
}
