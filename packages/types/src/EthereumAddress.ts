import { getAddress } from 'viem'

import { randomHexDigit } from './utils/randomHexDigit'

export interface EthereumAddress extends String {
  _EthereumAddressBrand: string
}

export function EthereumAddress(value: string): EthereumAddress {
  try {
    return getAddress(value) as unknown as EthereumAddress
  } catch {
    throw new TypeError('Invalid EthereumAddress')
  }
}

EthereumAddress.ZERO = EthereumAddress('0x' + '0'.repeat(40))

EthereumAddress.check = function check(value: string): boolean {
  try {
    return EthereumAddress(value).toString() === value
  } catch {
    return false
  }
}

EthereumAddress.isBefore = function isBefore(
  a: EthereumAddress,
  b: EthereumAddress,
): boolean {
  return a.toLowerCase() < b.toLowerCase()
}

EthereumAddress.inOrder = function inOrder(
  a: EthereumAddress,
  b: EthereumAddress,
): [EthereumAddress, EthereumAddress] {
  return EthereumAddress.isBefore(a, b) ? [a, b] : [b, a]
}

EthereumAddress.random = function random(): EthereumAddress {
  return EthereumAddress(
    '0x' + Array.from({ length: 40 }).map(randomHexDigit).join(''),
  )
}

EthereumAddress.unsafe = function unsafe(address: string): EthereumAddress {
  return address as unknown as EthereumAddress
}
