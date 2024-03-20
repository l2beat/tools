export const Height = {
  lt,
  lte,
  gt,
  gte,
  min,
}

function lt(heightA: number | undefined, heightB: number | undefined): boolean {
  if (heightA === heightB) {
    return false
  }
  return !gt(heightA, heightB)
}

function lte(
  heightA: number | undefined,
  heightB: number | undefined,
): boolean {
  return !gt(heightA, heightB)
}

function gt(heightA: number | undefined, heightB: number | undefined): boolean {
  if (heightA === undefined) {
    return false
  }
  if (heightB === undefined) {
    return true
  }
  return heightA > heightB
}

function gte(
  heightA: number | undefined,
  heightB: number | undefined,
): boolean {
  return !lt(heightA, heightB)
}

function min(...heights: (number | undefined)[]): number | undefined {
  if (heights.length === 0) {
    return undefined
  }
  let minHeight = heights[0]
  for (const height of heights) {
    if (gt(minHeight, height)) {
      minHeight = height
    }
  }
  return minHeight
}
