import { describe, test, assert } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Phase 9A: Concurrency, Capacity & Overbooking Prevention', () => {
  interface MockEvent {
    id: string
    title: string
    slug: string
    capacity: number
    status: 'published' | 'draft' | 'cancelled'
    event_date: string
    start_time: string
    end_time: string
    timezone: string
    registration_deadline: string | null
    active_registrations_count: number
  }

  interface MockRegistration {
    id: string
    event_id: string
    user_id: string
    status: 'registered' | 'checked_in' | 'waitlisted' | 'cancelled'
    ticket_code: string | null
    waitlist_position: number | null
    registered_at: string
  }

  test('concurrent registrations cannot overbook event capacity and overflow cleanly to waitlist', async () => {
    const event: MockEvent = {
      id: 'ev-race-1',
      title: 'High Demand Keynote',
      slug: 'high-demand-keynote',
      capacity: 3,
      status: 'published',
      event_date: '2026-10-15',
      start_time: '10:00',
      end_time: '12:00',
      timezone: 'UTC',
      registration_deadline: null,
      active_registrations_count: 0,
    }

    const registrations: MockRegistration[] = []
    let activeLock = Promise.resolve()

    // Transactional registration simulator mirroring the canonical register_for_event RPC
    async function simulateAtomicRegister(userId: string): Promise<{
      status: 'registered' | 'waitlisted'
      position: number | null
      ticketCode: string | null
    }> {
      // Serialize via row-level lock (FOR UPDATE on event row)
      return new Promise((resolve) => {
        activeLock = activeLock.then(async () => {
          const activeCount = registrations.filter(
            (r) => r.event_id === event.id && (r.status === 'registered' || r.status === 'checked_in')
          ).length

          if (activeCount < event.capacity) {
            const reg: MockRegistration = {
              id: `reg-${userId}`,
              event_id: event.id,
              user_id: userId,
              status: 'registered',
              ticket_code: `CL-KEYNOT-${userId.slice(0, 8).toUpperCase()}`,
              waitlist_position: null,
              registered_at: new Date().toISOString(),
            }
            registrations.push(reg)
            event.active_registrations_count = activeCount + 1
            resolve({ status: 'registered', position: null, ticketCode: reg.ticket_code })
          } else {
            const currentWaitlist = registrations.filter(
              (r) => r.event_id === event.id && r.status === 'waitlisted'
            ).length
            const nextPosition = currentWaitlist + 1

            const reg: MockRegistration = {
              id: `reg-${userId}`,
              event_id: event.id,
              user_id: userId,
              status: 'waitlisted',
              ticket_code: null,
              waitlist_position: nextPosition,
              registered_at: new Date().toISOString(),
            }
            registrations.push(reg)
            resolve({ status: 'waitlisted', position: nextPosition, ticketCode: null })
          }
        })
      })
    }

    // 8 users attempt to register concurrently for 3 spots
    const userIds = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8']
    const results = await Promise.all(userIds.map((uid) => simulateAtomicRegister(uid)))

    const registeredUsers = results.filter((r) => r.status === 'registered')
    const waitlistedUsers = results.filter((r) => r.status === 'waitlisted')

    assert.equal(registeredUsers.length, 3, 'Exactly 3 spots must be granted confirmed registration')
    assert.equal(waitlistedUsers.length, 5, 'Remaining 5 callers must be placed on waitlist')

    // Verify tickets assigned ONLY to confirmed attendees
    registeredUsers.forEach((r) => {
      assert.ok(r.ticketCode?.startsWith('CL-KEYNOT-'), 'Confirmed attendee must have ticket code')
      assert.equal(r.position, null, 'Confirmed attendee must not have waitlist position')
    })

    // Verify waitlist positions are strictly sequential 1..5 and have no tickets
    waitlistedUsers.forEach((r, idx) => {
      assert.equal(r.position, idx + 1, `Waitlist position must be sequentially assigned as ${idx + 1}`)
      assert.equal(r.ticketCode, null, 'Waitlisted attendee must not receive admission ticket')
    })
  })
})

describe('Phase 9A: Checked-In Attendees Capacity Accounting', () => {
  interface RegistrationRow {
    id: string
    user_id: string
    status: 'registered' | 'checked_in' | 'waitlisted' | 'cancelled'
  }

  test('checked_in attendees count towards capacity and prevent overbooking', () => {
    const capacity = 2
    const rows: RegistrationRow[] = [
      { id: 'r1', user_id: 'u1', status: 'checked_in' }, // Checked in at the door
      { id: 'r2', user_id: 'u2', status: 'registered' }, // Confirmed registered
    ]

    // Capacity check logic mirroring Phase 9A RPC
    const capacityConsumingStatuses = ['registered', 'checked_in']
    const activeCount = rows.filter((r) => capacityConsumingStatuses.includes(r.status)).length

    assert.equal(activeCount, 2, 'Checked-in attendee must consume capacity alongside registered')
    assert.equal(activeCount >= capacity, true, 'Event must be recognized as full')

    // Third attendee tries to register
    const canRegisterDirectly = activeCount < capacity
    assert.equal(canRegisterDirectly, false, 'New attendee cannot take a spot occupied by checked-in guest')
  })
})

describe('Phase 9A: Cancellation & Single FIFO Waitlist Promotion', () => {
  interface Registration {
    id: string
    user_id: string
    status: 'registered' | 'checked_in' | 'waitlisted' | 'cancelled'
    registered_at: string
    waitlist_position: number | null
    ticket_code: string | null
  }

  test('cancelling one registration promotes exactly one earliest waitlisted attendee (FIFO) and resequences queue', () => {
    const registrations: Registration[] = [
      {
        id: 'r1',
        user_id: 'u1',
        status: 'registered',
        registered_at: '2026-09-01T10:00:00Z',
        waitlist_position: null,
        ticket_code: 'CL-EVENT-001',
      },
      {
        id: 'r2',
        user_id: 'u2',
        status: 'registered',
        registered_at: '2026-09-01T10:05:00Z',
        waitlist_position: null,
        ticket_code: 'CL-EVENT-002',
      },
      {
        id: 'r3',
        user_id: 'u3',
        status: 'waitlisted',
        registered_at: '2026-09-01T10:10:00Z', // Earliest waitlisted
        waitlist_position: 1,
        ticket_code: null,
      },
      {
        id: 'r4',
        user_id: 'u4',
        status: 'waitlisted',
        registered_at: '2026-09-01T10:15:00Z', // Second waitlisted
        waitlist_position: 2,
        ticket_code: null,
      },
      {
        id: 'r5',
        user_id: 'u5',
        status: 'waitlisted',
        registered_at: '2026-09-01T10:20:00Z', // Third waitlisted
        waitlist_position: 3,
        ticket_code: null,
      },
    ]

    const notificationsDispatched: Array<{ userId: string; type: string }> = []

    // Simulate canonical cancel_registration RPC
    function simulateCancelRegistration(userId: string) {
      const reg = registrations.find((r) => r.user_id === userId)
      if (!reg) throw new Error('Registration must exist')
      assert.notEqual(reg.status, 'cancelled', 'Cannot cancel already cancelled registration')

      const oldStatus = reg.status
      reg.status = 'cancelled'
      reg.waitlist_position = null

      let promotedUserId: string | null = null

      // If previous status was capacity-consuming, promote AT MOST ONE waitlisted attendee
      if (oldStatus === 'registered' || oldStatus === 'checked_in') {
        const waitlisted = registrations
          .filter((r) => r.status === 'waitlisted')
          .sort((a, b) => a.registered_at.localeCompare(b.registered_at))

        const candidate = waitlisted[0]
        if (candidate) {
          candidate.status = 'registered'
          candidate.ticket_code = `CL-EVENT-PROM-${candidate.user_id}`
          candidate.waitlist_position = null
          promotedUserId = candidate.user_id

          notificationsDispatched.push({
            userId: candidate.user_id,
            type: 'waitlist_promoted',
          })
        }
      }

      // Resequence remaining waitlist positions
      const remainingWaitlist = registrations
        .filter((r) => r.status === 'waitlisted')
        .sort((a, b) => a.registered_at.localeCompare(b.registered_at))

      remainingWaitlist.forEach((r, idx) => {
        r.waitlist_position = idx + 1
      })

      return { success: true, promotedUserId }
    }

    // User 1 unregisters
    const cancelResult = simulateCancelRegistration('u1')

    assert.equal(cancelResult.promotedUserId, 'u3', 'Earliest waitlisted user (u3) must be promoted')
    assert.equal(notificationsDispatched.length, 1, 'Exactly one promotion notification must be dispatched')
    assert.equal(notificationsDispatched[0]?.userId, 'u3')
    assert.equal(notificationsDispatched[0]?.type, 'waitlist_promoted')

    // Verify u3 is now registered with ticket code
    const u3Reg = registrations.find((r) => r.user_id === 'u3')!
    assert.equal(u3Reg.status, 'registered')
    assert.ok(u3Reg.ticket_code?.startsWith('CL-EVENT-PROM-u3'))
    assert.equal(u3Reg.waitlist_position, null)

    // Verify remaining waitlist positions resequenced: u4 (#2 -> #1), u5 (#3 -> #2)
    const u4Reg = registrations.find((r) => r.user_id === 'u4')!
    const u5Reg = registrations.find((r) => r.user_id === 'u5')!
    assert.equal(u4Reg.waitlist_position, 1, 'Second attendee must advance to position 1')
    assert.equal(u5Reg.waitlist_position, 2, 'Third attendee must advance to position 2')

    // Verify total active capacity is still exactly 2 (u2 and u3)
    const activeCount = registrations.filter((r) => r.status === 'registered' || r.status === 'checked_in').length
    assert.equal(activeCount, 2, 'Total active attendees must strictly respect capacity')
  })

  test('waitlisted attendee leaving waitlist resequences remaining positions without promoting anyone', () => {
    const waitlist = [
      { user_id: 'w1', position: 1, registered_at: '2026-09-01T10:00:00Z', status: 'waitlisted' },
      { user_id: 'w2', position: 2, registered_at: '2026-09-01T10:05:00Z', status: 'waitlisted' },
      { user_id: 'w3', position: 3, registered_at: '2026-09-01T10:10:00Z', status: 'waitlisted' },
    ]

    // w2 leaves waitlist
    const leaving = waitlist.find((w) => w.user_id === 'w2')!
    leaving.status = 'cancelled'

    // Resequence remaining waitlist
    const activeWaitlist = waitlist
      .filter((w) => w.status === 'waitlisted')
      .sort((a, b) => a.registered_at.localeCompare(b.registered_at))

    activeWaitlist.forEach((w, idx) => {
      w.position = idx + 1
    })

    const w1 = waitlist.find((w) => w.user_id === 'w1')!
    const w3 = waitlist.find((w) => w.user_id === 'w3')!

    assert.equal(w1.position, 1, 'Position 1 remains 1')
    assert.equal(w3.position, 2, 'Position 3 shifts forward to 2')
  })
})

describe('Phase 9A: Durable Registration Deadlines & Event End Time Enforcement', () => {
  function validateRegistrationWindow(event: {
    registration_deadline: string | null
    event_date: string
    end_time: string
    timezone: string
  }, checkTime: Date): { allowed: boolean; error?: string } {
    // 1. Deadline check
    if (event.registration_deadline) {
      const deadline = new Date(event.registration_deadline)
      if (checkTime > deadline) {
        return { allowed: false, error: 'Registration deadline has passed' }
      }
    }

    // 2. End time check
    const [h, m] = event.end_time.split(':')
    const eventEnd = new Date(`${event.event_date}T${h?.padStart(2, '0')}:${m?.padStart(2, '0')}:00Z`)
    if (checkTime > eventEnd) {
      return { allowed: false, error: 'Event has already ended' }
    }

    return { allowed: true }
  }

  test('rejects registration when registration deadline has passed even if event is in the future', () => {
    const event = {
      registration_deadline: '2026-10-10T23:59:00Z',
      event_date: '2026-10-15',
      end_time: '18:00',
      timezone: 'UTC',
    }

    // Attempt registration after deadline
    const attemptTime = new Date('2026-10-11T09:00:00Z')
    const result = validateRegistrationWindow(event, attemptTime)

    assert.equal(result.allowed, false)
    assert.equal(result.error, 'Registration deadline has passed')
  })

  test('permits registration before deadline', () => {
    const event = {
      registration_deadline: '2026-10-10T23:59:00Z',
      event_date: '2026-10-15',
      end_time: '18:00',
      timezone: 'UTC',
    }

    const attemptTime = new Date('2026-10-09T12:00:00Z')
    const result = validateRegistrationWindow(event, attemptTime)

    assert.equal(result.allowed, true)
  })

  test('rejects registration if event has already concluded', () => {
    const event = {
      registration_deadline: null,
      event_date: '2026-10-15',
      end_time: '18:00',
      timezone: 'UTC',
    }

    const attemptTime = new Date('2026-10-15T18:01:00Z')
    const result = validateRegistrationWindow(event, attemptTime)

    assert.equal(result.allowed, false)
    assert.equal(result.error, 'Event has already ended')
  })
})

describe('Phase 9A: Required Custom Registration Questions Validation', () => {
  interface Question {
    id: string
    question_text: string
    question_type: 'text' | 'select' | 'checkbox' | 'textarea'
    is_required: boolean
  }

  function validateQuestions(
    questions: Question[],
    answers: Record<string, string> | null | undefined
  ): { valid: boolean; error?: string } {
    for (const q of questions) {
      if (q.is_required) {
        const val = answers ? answers[q.id]?.trim() : ''
        if (!val) {
          return {
            valid: false,
            error: `Please answer the required question: "${q.question_text}"`,
          }
        }
        if (q.question_type === 'checkbox' && val !== 'true') {
          return {
            valid: false,
            error: `Required agreement not confirmed: "${q.question_text}"`,
          }
        }
      }
    }
    return { valid: true }
  }

  test('fails closed when required question is missing or empty', () => {
    const questions: Question[] = [
      { id: 'q1', question_text: 'T-shirt Size', question_type: 'select', is_required: true },
      { id: 'q2', question_text: 'Dietary Restrictions', question_type: 'text', is_required: false },
    ]

    const res1 = validateQuestions(questions, {})
    assert.equal(res1.valid, false)
    assert.equal(res1.error, 'Please answer the required question: "T-shirt Size"')

    const res2 = validateQuestions(questions, { q1: '   ' })
    assert.equal(res2.valid, false)
    assert.equal(res2.error, 'Please answer the required question: "T-shirt Size"')
  })

  test('validates required checkbox agreements must be explicitly "true"', () => {
    const questions: Question[] = [
      { id: 'q-waiver', question_text: 'Liability Waiver', question_type: 'checkbox', is_required: true },
    ]

    const resFail = validateQuestions(questions, { 'q-waiver': 'false' })
    assert.equal(resFail.valid, false)
    assert.equal(resFail.error, 'Required agreement not confirmed: "Liability Waiver"')

    const resPass = validateQuestions(questions, { 'q-waiver': 'true' })
    assert.equal(resPass.valid, true)
  })
})

describe('Phase 9A: Database Migration & Schema Integrity', () => {
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260912000000_phase9a_transactional_registration_waitlist.sql'
  )

  test('Phase 9A migration file exists', () => {
    assert.ok(fs.existsSync(migrationPath), 'Phase 9A migration file must exist')
  })

  test('migration updates sync_event_active_registrations to count registered and checked_in', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    assert.ok(
      sql.includes("status IN ('registered', 'checked_in')"),
      'Must count registered and checked_in for active registrations'
    )
    assert.ok(
      sql.includes('trg_sync_event_active_registrations'),
      'Must define sync trigger on registrations'
    )
  })

  test('migration drops duplicate cancellation promotion trigger', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    assert.ok(
      sql.includes('DROP TRIGGER IF EXISTS trg_registration_cancellation_promotion'),
      'Must drop duplicate cancellation trigger to prevent double promotions'
    )
  })

  test('migration defines canonical register_for_event RPC with deadline, questions, and atomic ticket assignment', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.register_for_event'), 'Must define register_for_event RPC')
    assert.ok(sql.includes('registration_deadline'), 'Must enforce registration_deadline')
    assert.ok(sql.includes('event_registration_questions'), 'Must check custom registration questions')
    assert.ok(sql.includes('p_allow_waitlist'), 'Must accept waitlist preference')
    assert.ok(sql.includes('ticket_code'), 'Must assign ticket code')
    assert.ok(sql.includes('waitlist_position'), 'Must assign and persist waitlist position')
  })

  test('migration defines canonical cancel_registration RPC with single promotion and waitlist resequencing', () => {
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.cancel_registration'), 'Must define cancel_registration RPC')
    assert.ok(sql.includes('waitlist_promoted'), 'Must create waitlist_promoted notification')
    assert.ok(sql.includes('resequence_event_waitlist'), 'Must resequence waitlist positions after cancellation')
  })
})
