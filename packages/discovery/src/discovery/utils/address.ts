import { Bytes } from '../../utils/Bytes'
import { EthereumAddress } from '../../utils/EthereumAddress'

export function bytes32ToAddress(bytes32: Bytes): EthereumAddress {
  return EthereumAddress(bytes32.slice(12, 32).toString())
}

export function addressToBytes32(address: EthereumAddress): Bytes {
  return Bytes.fromHex(`000000000000000000000000${address.toString().slice(2)}`)
}
