import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { RateLimitResult } from '@/types'

export interface CheckRateLimitOptions {
  key: string
  action: string
  maxRequests: number
  windowSeconds: number
}

// In-memory fallback if database table/RPC is temporarily unreachable
const fallbackCache = new Map<string, { count: number; expiresAt: number }>()

/**
 * Durable rate limiter backed by Postgres table and atomic check_rate_limit function.
 * Survives process restarts and shared across serverless instances.
 */
export async function checkDurableRateLimit(
  supabase: SupabaseClient<Database>,
  options: CheckRateLimitOptions
): Promise<RateLimitResult> {
  const { key, action, maxRequests, windowSeconds } = options

  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_action: action,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    })

    if (!error && data) {
      const res = data as unknown as RateLimitResult
      return {
        allowed: Boolean(res.allowed),
        remaining: typeof res.remaining === 'number' ? res.remaining : 0,
        reset_at: res.reset_at || new Date(Date.now() + windowSeconds * 1000).toISOString(),
        retry_after_seconds: res.retry_after_seconds,
      }
    }

    if (error && process.env.NODE_ENV !== 'test') {
      console.warn('check_rate_limit RPC warning:', error.message)
    }
  } catch (rpcErr) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Failed to call check_rate_limit RPC, using memory fallback:', rpcErr)
    }
  }

  // Resilient memory fallback
  const memKey = `${key}:${action}`
  const now = Date.now()
  const current = fallbackCache.get(memKey)

  if (!current || current.expiresAt <= now) {
    const expiresAt = now + windowSeconds * 1000
    fallbackCache.set(memKey, { count: 1, expiresAt })
    return {
      allowed: true,
      remaining: maxRequests - 1,
      reset_at: new Date(expiresAt).toISOString(),
    }
  }

  if (current.count >= maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((current.expiresAt - now) / 1000))
    return {
      allowed: false,
      remaining: 0,
      reset_at: new Date(current.expiresAt).toISOString(),
      retry_after_seconds: retryAfter,
    }
  }

  current.count++
  return {
    allowed: true,
    remaining: maxRequests - current.count,
    reset_at: new Date(current.expiresAt).toISOString(),
  }
}
