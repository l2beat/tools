export function randomHexDigit(): string {
  return '0123456789abcdef'[Math.floor(Math.random() * 16)] ?? '0'
}
