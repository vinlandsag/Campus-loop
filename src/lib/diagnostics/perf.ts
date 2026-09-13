/* eslint-disable no-console */
/**
 * Development Performance Diagnostics
 *
 * Provides dev-only timing instrumentation for critical paths:
 * - auth lookup
 * - profile/role lookup
 * - campus lookup
 * - admin lookup
 * - event listing/detail queries
 * - dashboard queries
 *
 * PRIVACY & INTEGRITY GUARANTEES:
 * 1. Strictly disabled in production (`process.env.NODE_ENV === 'development'`).
 * 2. NEVER logs private data, user IDs, emails, tokens, registration data, or query payloads.
 * 3. Does not alter return values or throw unexpected diagnostic errors.
 */

export type PerfOperation =
  | 'auth:lookup'
  | 'profile:role_lookup'
  | 'campus:lookup'
  | 'admin:lookup'
  | 'event:listing'
  | 'event:detail'
  | 'dashboard:queries'
  | (string & {})

/**
 * Check whether performance diagnostics are active.
 * Only active in development environments.
 */
export function isDevPerfEnabled(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Execute an operation with development-only timing instrumentation.
 * In production or test environments (unless NODE_ENV is explicitly 'development'),
 * this executes the function directly with zero overhead and zero logs.
 *
 * Strictly avoids logging query parameters, user details, or return data.
 */
export async function measureDevPerf<T>(
  operation: PerfOperation,
  fn: () => Promise<T> | T
): Promise<T> {
  if (!isDevPerfEnabled()) {
    return fn()
  }

  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    console.info(`[perf] ${operation} completed in ${duration.toFixed(2)}ms`)
    return result
  } catch (error) {
    const duration = performance.now() - start
    console.warn(`[perf] ${operation} failed in ${duration.toFixed(2)}ms`)
    throw error
  }
}

/**
 * Start a dev-only timer that returns a stop callback.
 * Useful for measuring lifecycle stages or multi-step blocks.
 */
export function startDevTimer(operation: PerfOperation): () => void {
  if (!isDevPerfEnabled()) {
    return () => {}
  }

  const start = performance.now()
  return () => {
    const duration = performance.now() - start
    console.info(`[perf] ${operation} completed in ${duration.toFixed(2)}ms`)
  }
}
