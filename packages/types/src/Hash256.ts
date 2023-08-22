import { randomHexDigit } from './utils/randomHexDigit'

export interface Hash256 extends String {
  _Hash256Brand: string
}

export function Hash256(value: string): Hash256 {
  if (!/^0x[\da-f]{64}$/.test(value)) {
    throw new TypeError('Invalid Hash256')
  }
  return value as unknown as Hash256
}

Hash256.random = function random(): Hash256 {
  return Hash256('0x' + Array.from({ length: 64 }).map(randomHexDigit).join(''))
}
