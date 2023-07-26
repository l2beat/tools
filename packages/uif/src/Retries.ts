import assert from 'node:assert'

export interface RetryStrategy {
  shouldRetry: () => boolean
  timeoutMs: () => number
  clear: () => void
}

interface ExponentialBackOffOpts {
  stepMs: number
  maxAttempts: number
  maxDistanceMs?: number
}

/**
 *
 * @param opts.maxAttempts - use Infinity for indefinite retries
 * @returns
 */
function exponentialBackoff(opts: ExponentialBackOffOpts): RetryStrategy {
  let attempts = 0
  const maxAttempts = opts.maxAttempts
  assert(maxAttempts > 0)
  const maxDistanceMs = opts.maxDistanceMs ?? Infinity
  assert(maxDistanceMs > 0)

  return {
    shouldRetry: () => {
      attempts++
      return attempts <= maxAttempts
    },
    timeoutMs: () => {
      const distance = Math.pow(2, attempts) * opts.stepMs
      return Math.min(distance, maxDistanceMs)
    },
    clear: () => {
      attempts = 0
    },
  }
}

export const Retries = {
  exponentialBackoff,
}
