import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  measureDevPerf,
  startDevTimer,
  isDevPerfEnabled,
  type PerfOperation,
} from '@/lib/diagnostics/perf'

describe('Development Performance Diagnostics', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('When NODE_ENV is "development"', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development')
    })

    it('confirms dev diagnostics are enabled', () => {
      expect(isDevPerfEnabled()).toBe(true)
    })

    it('measures async operations and logs timing with [perf] prefix', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

      const result = await measureDevPerf('auth:lookup', async () => {
        return { user: { id: 'usr_secret_123', email: 'student@example.com' } }
      })

      expect(result).toEqual({ user: { id: 'usr_secret_123', email: 'student@example.com' } })
      expect(consoleSpy).toHaveBeenCalledTimes(1)
      const loggedMessage = consoleSpy.mock.calls[0]?.[0] as string
      expect(loggedMessage).toMatch(/^\[perf\] auth:lookup completed in \d+(\.\d+)?ms$/)
    })

    it('never leaks private data, user IDs, emails, tokens, or payloads into logs', async () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const sensitiveUserId = 'user_999_secret'
      const sensitiveEmail = 'private-student@university.edu'
      const sensitiveToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret'
      const sensitivePayload = { query: 'SELECT * FROM private_vault', registration_code: 'REG-999' }

      await measureDevPerf('profile:role_lookup', async () => {
        return {
          id: sensitiveUserId,
          email: sensitiveEmail,
          token: sensitiveToken,
          payload: sensitivePayload,
        }
      })

      // Inspect all console calls
      const allCalls = [
        ...infoSpy.mock.calls.flat(),
        ...warnSpy.mock.calls.flat(),
        ...logSpy.mock.calls.flat(),
      ].map(String)

      for (const call of allCalls) {
        expect(call).not.toContain(sensitiveUserId)
        expect(call).not.toContain(sensitiveEmail)
        expect(call).not.toContain(sensitiveToken)
        expect(call).not.toContain('private_vault')
        expect(call).not.toContain('REG-999')
      }
    })

    it('handles all required diagnostics categories', async () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

      const requiredCategories: PerfOperation[] = [
        'auth:lookup',
        'profile:role_lookup',
        'campus:lookup',
        'admin:lookup',
        'event:listing',
        'event:detail',
        'dashboard:queries',
      ]

      for (const cat of requiredCategories) {
        await measureDevPerf(cat, async () => true)
      }

      expect(infoSpy).toHaveBeenCalledTimes(requiredCategories.length)
      requiredCategories.forEach((cat, index) => {
        expect(infoSpy.mock.calls[index]?.[0]).toMatch(
          new RegExp(`^\\[perf\\] ${cat} completed in \\d+(\\.\\d+)?ms$`)
        )
      })
    })

    it('logs failure with timing and rethrows on error', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await expect(
        measureDevPerf('event:detail', async () => {
          throw new Error('Database connection failed')
        })
      ).rejects.toThrow('Database connection failed')

      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0]?.[0]).toMatch(
        /^\[perf\] event:detail failed in \d+(\.\d+)?ms$/
      )
    })

    it('supports manual startDevTimer in development', () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

      const stopTimer = startDevTimer('dashboard:queries')
      stopTimer()

      expect(infoSpy).toHaveBeenCalledTimes(1)
      expect(infoSpy.mock.calls[0]?.[0]).toMatch(
        /^\[perf\] dashboard:queries completed in \d+(\.\d+)?ms$/
      )
    })
  })

  describe('When NODE_ENV is "production"', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production')
    })

    it('confirms dev diagnostics are disabled', () => {
      expect(isDevPerfEnabled()).toBe(false)
    })

    it('emits zero logs and executes function directly', async () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const result = await measureDevPerf('admin:lookup', async () => {
        return { authorized: true }
      })

      expect(result).toEqual({ authorized: true })
      expect(infoSpy).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
      expect(logSpy).not.toHaveBeenCalled()
    })

    it('startDevTimer returns a no-op that emits zero logs', () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

      const stopTimer = startDevTimer('campus:lookup')
      stopTimer()

      expect(infoSpy).not.toHaveBeenCalled()
    })
  })
})
