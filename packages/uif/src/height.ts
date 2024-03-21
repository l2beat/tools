export const Height = {
  lt,
  lte,
  gt,
  gte,
  min,
}

function lt(heightA: number | null, heightB: number | null): boolean {
  if (heightA === heightB) {
    return false
  }
  return !gt(heightA, heightB)
}

function lte(heightA: number | null, heightB: number | null): boolean {
  return !gt(heightA, heightB)
}

function gt(heightA: number | null, heightB: number | null): boolean {
  if (heightA === null) {
    return false
  }
  if (heightB === null) {
    return true
  }
  return heightA > heightB
}

function gte(heightA: number | null, heightB: number | null): boolean {
  return !lt(heightA, heightB)
}

function min(...heights: (number | null)[]): number | null {
  if (heights.length === 0) {
    return null
  }
  let minHeight = heights[0] ?? null
  for (const height of heights) {
    if (gt(minHeight, height)) {
      minHeight = height
    }
  }
  return minHeight
}
