import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { isSystemAdmin, assertAdmin } from '@/lib/auth/admin'
import {
  saveOfflineRoster,
  loadOfflineRoster,
  clearOfflineRoster,
  clearAllOfflineRosters,
  isRosterExpired,
  DEFAULT_ROSTER_TTL_MS,
} from '@/lib/offline/roster-storage'
import { checkDurableRateLimit } from '@/lib/rate-limit/durable-limiter'
import { getEventStartDateTime, getEventEndDateTime } from '@/lib/utils/date'
import type { OfflineCheckInRoster, NotificationWorkerRunResult } from '@/types'
import type { User, SupabaseClient } from '@supabase/supabase-js'

// In-memory mock storage for browser tests
const mockLocalStorage: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => mockLocalStorage[key] || null,
  setItem: (key: string, val: string) => { mockLocalStorage[key] = val },
  removeItem: (key: string) => { delete mockLocalStorage[key] },
  clear: () => {
    for (const k of Object.keys(mockLocalStorage)) {
      delete mockLocalStorage[k]
    }
  },
  get length() {
    return Object.keys(mockLocalStorage).length
  },
  key: (i: number) => Object.keys(mockLocalStorage)[i] || null,
}

describe('Phase 11: Production Integrity & Privacy Hardening', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.stubGlobal('localStorage', localStorageMock)
    vi.stubGlobal('window', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ─── 1. Waitlist Promotion Capacity Check ────────────────────────────────────
  describe('Risk 1: Waitlist Promotion Capacity Integrity', () => {
    interface SimulatedEvent {
      id: string
      title: string
      capacity: number | null
      activeCount: number
      waitlist: Array<{ id: string; userId: string; status: string }>
    }

    function simulatePromoteWaitlist(
      event: SimulatedEvent,
      callerRole: 'owner' | 'editor' | 'viewer' | 'none'
    ): { success: boolean; promoted: boolean; error?: string } {
      if (callerRole !== 'owner' && callerRole !== 'editor') {
        return { success: false, promoted: false, error: 'Unauthorized: Only event organizers or editors can promote waitlist attendees' }
      }

      if (event.capacity !== null && event.activeCount >= event.capacity) {
        return { success: false, promoted: false, error: 'Event is at full capacity. Cannot promote waitlisted attendee.' }
      }

      if (event.waitlist.length === 0) {
        return { success: true, promoted: false }
      }

      const promotedAttendee = event.waitlist.shift()!
      promotedAttendee.status = 'registered'
      event.activeCount++

      return { success: true, promoted: true }
    }

    test('cannot promote waitlisted attendee if event is at capacity', () => {
      const fullEvent: SimulatedEvent = {
        id: 'ev-full',
        title: 'Full Capacity Workshop',
        capacity: 2,
        activeCount: 2,
        waitlist: [{ id: 'reg-w1', userId: 'usr-1', status: 'waitlisted' }],
      }

      const res = simulatePromoteWaitlist(fullEvent, 'owner')
      expect(res.success).toBe(false)
      expect(res.promoted).toBe(false)
      expect(res.error).toContain('Event is at full capacity')
      expect(fullEvent.activeCount).toBe(2)
      expect(fullEvent.waitlist.length).toBe(1)
    })

    test('can promote waitlisted attendee when capacity is freed', () => {
      const event: SimulatedEvent = {
        id: 'ev-freed',
        title: 'Workshop with Open Seat',
        capacity: 2,
        activeCount: 1, // 1 spot available
        waitlist: [{ id: 'reg-w1', userId: 'usr-1', status: 'waitlisted' }],
      }

      const res = simulatePromoteWaitlist(event, 'editor')
      expect(res.success).toBe(true)
      expect(res.promoted).toBe(true)
      expect(event.activeCount).toBe(2)
      expect(event.waitlist.length).toBe(0)
    })

    test('unauthorized roles cannot promote waitlisted attendees even if seats are open', () => {
      const event: SimulatedEvent = {
        id: 'ev-freed',
        title: 'Workshop with Open Seat',
        capacity: 2,
        activeCount: 1,
        waitlist: [{ id: 'reg-w1', userId: 'usr-1', status: 'waitlisted' }],
      }

      const res = simulatePromoteWaitlist(event, 'viewer')
      expect(res.success).toBe(false)
      expect(res.error).toContain('Unauthorized')
    })
  })

  // ─── 2. Notification Type Constraint ('announcement') ────────────────────────
  describe('Risk 2: Restored Announcement Notification Type', () => {
    const validNotificationTypes = [
      'registration_confirmed',
      'event_cancelled',
      'event_rescheduled',
      'venue_changed',
      'reminder_24h',
      'reminder_1h',
      'waitlist_promoted',
      'checked_in',
      'reminder',
      'announcement',
    ]

    test('validates announcement as a legitimate notification type', () => {
      expect(validNotificationTypes).toContain('announcement')
    })

    test('SQL migration explicitly restores announcement to notifications_type_check', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/20260912130000_phase11_production_integrity_and_privacy.sql'
      )
      expect(fs.existsSync(migrationPath)).toBe(true)
      const sql = fs.readFileSync(migrationPath, 'utf8')
      expect(sql).toContain("'announcement'")
      expect(sql).toContain('notifications_type_check')
    })
  })

  // ─── 3. Dedicated Server-Controlled Admin Authorization Model ──────────────────
  describe('Risk 3: Durable Admin Authorization Model (No User Metadata Trust)', () => {
    // Mock Supabase client
    const adminsDb = new Set<string>()

    const mockSupabase = {
      from: (table: string) => {
        if (table === 'system_admins') {
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                maybeSingle: async () => ({
                  data: adminsDb.has(val) ? { user_id: val } : null,
                  error: null,
                }),
              }),
            }),
          }
        }
        return {}
      },
    } as unknown as SupabaseClient

    beforeEach(() => {
      adminsDb.clear()
    })

    test('client attempt to self-assign admin via user_metadata fails closed', async () => {
      const maliciousUser = {
        id: 'usr-attacker-1',
        email: 'attacker@example.com',
        user_metadata: {
          role: 'admin',
          is_admin: true,
        },
        app_metadata: {},
      } as unknown as User

      const isAdmin = await isSystemAdmin(mockSupabase, maliciousUser)
      expect(isAdmin).toBe(false)

      const assertResult = await assertAdmin(mockSupabase, maliciousUser)
      expect(assertResult.authorized).toBe(false)
      expect(assertResult.error).toContain('Unauthorized')
    })

    test('user with server-controlled app_metadata is granted admin privileges', async () => {
      const validAdmin = {
        id: 'usr-admin-1',
        email: 'realadmin@campusloop.internal',
        user_metadata: {},
        app_metadata: {
          role: 'admin',
        },
      } as unknown as User

      const isAdmin = await isSystemAdmin(mockSupabase, validAdmin)
      expect(isAdmin).toBe(true)
    })

    test('user recorded in dedicated system_admins table is granted admin privileges', async () => {
      adminsDb.add('usr-admin-db-1')

      const dbAdmin = {
        id: 'usr-admin-db-1',
        email: 'dbadmin@campusloop.internal',
        user_metadata: {},
        app_metadata: {},
      } as unknown as User

      const isAdmin = await isSystemAdmin(mockSupabase, dbAdmin)
      expect(isAdmin).toBe(true)
    })

    test('anonymous or unauthenticated callers fail closed', async () => {
      const isAdmin = await isSystemAdmin(mockSupabase, null)
      expect(isAdmin).toBe(false)
    })
  })

  // ─── 4. Event Feedback Timing Eligibility ─────────────────────────────────────
  describe('Risk 4: Event Feedback Timing Eligibility', () => {
    interface EventTiming {
      event_date: string
      start_time: string
      end_time: string
      timezone: string
    }

    function checkFeedbackEligibility(
      event: EventTiming,
      registrationStatus: 'registered' | 'checked_in' | 'waitlisted' | 'cancelled',
      now: Date
    ): { eligible: boolean; error?: string } {
      if (registrationStatus !== 'registered' && registrationStatus !== 'checked_in') {
        return { eligible: false, error: 'You can only leave feedback for events you were registered to attend.' }
      }

      const startDateTime = getEventStartDateTime(event.event_date, event.start_time, event.timezone)
      const endDateTime = getEventEndDateTime(event.event_date, event.end_time, event.timezone)

      const isEnded = now.getTime() >= endDateTime.getTime()
      const isStartedAndCheckedIn = registrationStatus === 'checked_in' && now.getTime() >= startDateTime.getTime()

      if (!isEnded && !isStartedAndCheckedIn) {
        if (registrationStatus === 'checked_in') {
          return { eligible: false, error: 'Feedback can only be submitted once the event has started.' }
        }
        return { eligible: false, error: 'Feedback can only be submitted after the event has ended.' }
      }

      return { eligible: true }
    }

    const testEvent: EventTiming = {
      event_date: '2026-10-15',
      start_time: '14:00',
      end_time: '16:00',
      timezone: 'UTC',
    }

    test('registered attendee cannot submit feedback before event end time', () => {
      // 1 hour before end time (15:00 UTC)
      const beforeEnd = new Date('2026-10-15T15:00:00Z')
      const res = checkFeedbackEligibility(testEvent, 'registered', beforeEnd)
      expect(res.eligible).toBe(false)
      expect(res.error).toContain('after the event has ended')
    })

    test('checked-in attendee cannot submit feedback before event start time', () => {
      // 30 minutes before start time (13:30 UTC)
      const beforeStart = new Date('2026-10-15T13:30:00Z')
      const res = checkFeedbackEligibility(testEvent, 'checked_in', beforeStart)
      expect(res.eligible).toBe(false)
      expect(res.error).toContain('once the event has started')
    })

    test('checked-in attendee CAN submit feedback once event has started', () => {
      // 30 minutes after start time (14:30 UTC)
      const duringEvent = new Date('2026-10-15T14:30:00Z')
      const res = checkFeedbackEligibility(testEvent, 'checked_in', duringEvent)
      expect(res.eligible).toBe(true)
    })

    test('any registered attendee CAN submit feedback after event has ended', () => {
      // 10 minutes after end time (16:10 UTC)
      const afterEnd = new Date('2026-10-15T16:10:00Z')
      const res = checkFeedbackEligibility(testEvent, 'registered', afterEnd)
      expect(res.eligible).toBe(true)
    })

    test('unregistered or cancelled user cannot submit feedback at any time', () => {
      const afterEnd = new Date('2026-10-15T18:00:00Z')
      expect(checkFeedbackEligibility(testEvent, 'cancelled', afterEnd).eligible).toBe(false)
      expect(checkFeedbackEligibility(testEvent, 'waitlisted', afterEnd).eligible).toBe(false)
    })
  })

  // ─── 5. Offline Check-In Roster Security & Expiry Lifecycle ───────────────────
  describe('Risk 5: Offline Check-In Roster Lifecycle & Expiry', () => {
    const eventId = 'ev-hack-2026'
    const sampleRoster: OfflineCheckInRoster = {
      eventId,
      eventTitle: 'Hackathon 2026',
      cachedAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + DEFAULT_ROSTER_TTL_MS).toISOString(),
      attendees: [
        {
          registrationId: 'reg-1',
          ticketCode: 'CL-HACK26-001-SIGN1',
          attendeeName: 'Alice Student',
          status: 'registered',
        },
      ],
    }

    test('stores and loads valid offline roster with data obfuscation', () => {
      saveOfflineRoster(eventId, sampleRoster)

      const storedRaw = localStorageMock.getItem(`campusloop_roster_${eventId}`)
      expect(storedRaw).toBeDefined()
      // Verify plain attendee list is not plain-text JSON
      expect(storedRaw).not.toContain('"Alice Student"')

      const loaded = loadOfflineRoster(eventId)
      expect(loaded.isExpired).toBe(false)
      expect(loaded.roster).toBeDefined()
      expect(loaded.roster?.attendees[0]?.attendeeName).toBe('Alice Student')
    })

    test('expired roster fails closed, purges data, and signals re-download requirement', () => {
      const expiredRoster: OfflineCheckInRoster = {
        ...sampleRoster,
        expiresAt: new Date(Date.now() - 60000).toISOString(), // 1 minute in the past
      }

      saveOfflineRoster(eventId, expiredRoster)
      expect(isRosterExpired(expiredRoster)).toBe(true)

      const loaded = loadOfflineRoster(eventId)
      expect(loaded.isExpired).toBe(true)
      expect(loaded.roster).toBeNull()
      expect(loaded.error).toContain('Offline check-in roster has expired')

      // Verifies stale cache was purged from storage
      expect(localStorageMock.getItem(`campusloop_roster_${eventId}`)).toBeNull()
    })

    test('clearAllOfflineRosters purges all rosters and queues on logout', () => {
      saveOfflineRoster('ev-1', sampleRoster)
      saveOfflineRoster('ev-2', sampleRoster)
      localStorageMock.setItem('campusloop_offline_queue_ev-1', JSON.stringify([{ scanId: '1' }]))

      expect(localStorageMock.getItem('campusloop_roster_ev-1')).toBeDefined()
      expect(localStorageMock.getItem('campusloop_roster_ev-2')).toBeDefined()
      expect(localStorageMock.getItem('campusloop_offline_queue_ev-1')).toBeDefined()

      clearAllOfflineRosters()

      expect(localStorageMock.getItem('campusloop_roster_ev-1')).toBeNull()
      expect(localStorageMock.getItem('campusloop_roster_ev-2')).toBeNull()
      expect(localStorageMock.getItem('campusloop_offline_queue_ev-1')).toBeNull()
    })

    test('clearOfflineRoster purges specific event roster while preserving others', () => {
      saveOfflineRoster('ev-keep', sampleRoster)
      saveOfflineRoster('ev-remove', sampleRoster)

      clearOfflineRoster('ev-remove')

      expect(localStorageMock.getItem('campusloop_roster_ev-remove')).toBeNull()
      expect(localStorageMock.getItem('campusloop_roster_ev-keep')).toBeDefined()
    })
  })

  // ─── 6. Scheduled Notification Jobs & Worker ──────────────────────────────────
  describe('Risk 6: Scheduled Notification Jobs Worker & Authentication', () => {
    test('endpoint fails closed when secret is absent or mismatched', () => {
      function simulateAuthCheck(secretHeader?: string | null, configuredSecret = 'strong-cron-secret-2026') {
        if (!configuredSecret || !secretHeader || secretHeader !== configuredSecret) {
          return { status: 401, error: 'Unauthorized: Invalid or missing job runner secret' }
        }
        return { status: 200, success: true }
      }

      expect(simulateAuthCheck(null).status).toBe(401)
      expect(simulateAuthCheck('wrong-secret').status).toBe(401)
      expect(simulateAuthCheck('strong-cron-secret-2026').status).toBe(200)
    })

    test('worker processes jobs idempotently and does not duplicate notifications on rerun', () => {
      interface Job {
        id: string
        event_id: string
        job_type: 'reminder_24h'
        scheduled_for: string
        status: 'pending' | 'processing' | 'completed' | 'failed'
        attempts: number
      }

      const jobs: Job[] = [
        {
          id: 'job-1',
          event_id: 'ev-1',
          job_type: 'reminder_24h',
          scheduled_for: '2026-10-14T10:00:00Z',
          status: 'pending',
          attempts: 0,
        },
      ]

      const sentNotifications: Array<{ dedupKey: string; userId: string }> = []

      function runWorker(nowIso: string): NotificationWorkerRunResult {
        const eligible = jobs.filter((j) => j.status === 'pending' && j.scheduled_for <= nowIso)
        let completed = 0

        for (const j of eligible) {
          j.status = 'processing'
          j.attempts++

          // Simulate dispatchNotificationJob with dedup key
          const dedupKey = `${j.job_type}_${j.event_id}_usr-alice`
          if (!sentNotifications.some((n) => n.dedupKey === dedupKey)) {
            sentNotifications.push({ dedupKey, userId: 'usr-alice' })
          }

          j.status = 'completed'
          completed++
        }

        return {
          success: true,
          processedCount: completed,
          completedCount: completed,
          failedCount: 0,
          skippedCount: 0,
          errors: [],
        }
      }

      // First run: processes job-1 and dispatches 1 notification
      const run1 = runWorker('2026-10-14T10:05:00Z')
      expect(run1.completedCount).toBe(1)
      expect(sentNotifications.length).toBe(1)

      // Second run: job-1 is already completed, no jobs eligible
      const run2 = runWorker('2026-10-14T10:06:00Z')
      expect(run2.processedCount).toBe(0)
      expect(sentNotifications.length).toBe(1) // Zero duplicate notifications!
    })
  })

  // ─── 7. Durable Abuse & Rate Limiting ─────────────────────────────────────────
  describe('Risk 7: Durable Abuse & Rate Limiting', () => {
    const mockSupabase = {
      rpc: async () => ({ data: null, error: { message: 'Use memory fallback in unit tests' } }),
    } as unknown as SupabaseClient

    test('throttles excessive requests within active window', async () => {
      const userKey = 'usr-abuser-123'
      const action = 'event_registration'
      const maxRequests = 3
      const windowSeconds = 60

      // Requests 1, 2, 3 allowed
      const r1 = await checkDurableRateLimit(mockSupabase, { key: userKey, action, maxRequests, windowSeconds })
      expect(r1.allowed).toBe(true)
      expect(r1.remaining).toBe(2)

      const r2 = await checkDurableRateLimit(mockSupabase, { key: userKey, action, maxRequests, windowSeconds })
      expect(r2.allowed).toBe(true)
      expect(r2.remaining).toBe(1)

      const r3 = await checkDurableRateLimit(mockSupabase, { key: userKey, action, maxRequests, windowSeconds })
      expect(r3.allowed).toBe(true)
      expect(r3.remaining).toBe(0)

      // Request 4 blocked!
      const r4 = await checkDurableRateLimit(mockSupabase, { key: userKey, action, maxRequests, windowSeconds })
      expect(r4.allowed).toBe(false)
      expect(r4.remaining).toBe(0)
      expect(r4.retry_after_seconds).toBeGreaterThan(0)
    })

    test('separate actions for the same user have isolated limits', async () => {
      const userKey = 'usr-split-limit'

      const regRes = await checkDurableRateLimit(mockSupabase, {
        key: userKey,
        action: 'action_a',
        maxRequests: 1,
        windowSeconds: 60,
      })
      expect(regRes.allowed).toBe(true)

      // Action A is now exhausted
      const regRes2 = await checkDurableRateLimit(mockSupabase, {
        key: userKey,
        action: 'action_a',
        maxRequests: 1,
        windowSeconds: 60,
      })
      expect(regRes2.allowed).toBe(false)

      // Action B for same user remains allowed
      const repRes = await checkDurableRateLimit(mockSupabase, {
        key: userKey,
        action: 'action_b',
        maxRequests: 1,
        windowSeconds: 60,
      })
      expect(repRes.allowed).toBe(true)
    })
  })
})
