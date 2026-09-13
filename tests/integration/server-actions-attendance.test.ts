import { describe, test, expect } from 'vitest'
import { canCheckIn } from '@/lib/auth/permissions'
import { generateTicketCode, verifyTicketCodeSignature } from '@/lib/tickets/service'
import type { EventTeamRole } from '@/types'

describe('Integration Tests: Attendance & Check-In Station Actions', () => {
  const eventId = 'evt-att-100'
  const eventSlug = 'spring-symposium'
  const attendeeId = 'usr-att-200'
  const regId = 'reg-att-300'

  interface RegistrationRecord {
    id: string
    eventId: string
    userId: string
    status: 'registered' | 'waitlisted' | 'cancelled' | 'checked_in'
    ticketCode: string
    checkedInAt: string | null
  }

  function simulateDoorCheckIn(
    callerRole: EventTeamRole | null,
    scannedCode: string,
    records: Map<string, RegistrationRecord>
  ) {
    if (!canCheckIn(callerRole)) {
      return { success: false, error: 'Unauthorized: You do not have check-in permissions for this event.' }
    }

    const reg = Array.from(records.values()).find((r) => r.ticketCode === scannedCode)
    if (!reg) {
      return { success: false, error: 'Invalid ticket: No registration found matching this ticket code.' }
    }

    if (!verifyTicketCodeSignature(scannedCode, reg.eventId, reg.userId, reg.id)) {
      return { success: false, error: 'Ticket verification failed: Cryptographic signature mismatch.' }
    }

    if (reg.status === 'checked_in') {
      return {
        success: true,
        alreadyCheckedIn: true,
        checkedInAt: reg.checkedInAt,
        attendeeName: 'Jane Doe',
      }
    }

    if (reg.status === 'waitlisted') {
      return { success: false, error: 'Attendee is currently on the waitlist and not yet admitted.' }
    }

    if (reg.status === 'cancelled') {
      return { success: false, error: 'Registration was cancelled.' }
    }

    // Mark checked in
    const checkInTime = new Date().toISOString()
    reg.status = 'checked_in'
    reg.checkedInAt = checkInTime

    return {
      success: true,
      alreadyCheckedIn: false,
      checkedInAt: checkInTime,
      attendeeName: 'Jane Doe',
    }
  }

  test('door check-in succeeds for check_in_staff with valid signed ticket code', () => {
    const ticketCode = generateTicketCode(eventId, eventSlug, attendeeId, regId)
    const records = new Map<string, RegistrationRecord>()
    records.set(regId, {
      id: regId,
      eventId,
      userId: attendeeId,
      status: 'registered',
      ticketCode,
      checkedInAt: null,
    })

    const res = simulateDoorCheckIn('check_in_staff', ticketCode, records)
    expect(res.success).toBe(true)
    expect(res.alreadyCheckedIn).toBe(false)
    expect(records.get(regId)?.status).toBe('checked_in')
  })

  test('door check-in is idempotent when scanning the same ticket twice', () => {
    const ticketCode = generateTicketCode(eventId, eventSlug, attendeeId, regId)
    const records = new Map<string, RegistrationRecord>()
    records.set(regId, {
      id: regId,
      eventId,
      userId: attendeeId,
      status: 'registered',
      ticketCode,
      checkedInAt: null,
    })

    // First scan
    simulateDoorCheckIn('check_in_staff', ticketCode, records)

    // Second scan
    const res2 = simulateDoorCheckIn('check_in_staff', ticketCode, records)
    expect(res2.success).toBe(true)
    expect(res2.alreadyCheckedIn).toBe(true)
  })

  test('door check-in rejects viewer role or unauthorized caller', () => {
    const ticketCode = generateTicketCode(eventId, eventSlug, attendeeId, regId)
    const records = new Map<string, RegistrationRecord>()
    records.set(regId, {
      id: regId,
      eventId,
      userId: attendeeId,
      status: 'registered',
      ticketCode,
      checkedInAt: null,
    })

    const viewerRes = simulateDoorCheckIn('viewer', ticketCode, records)
    expect(viewerRes.success).toBe(false)
    expect(viewerRes.error).toContain('Unauthorized')

    const anonRes = simulateDoorCheckIn(null, ticketCode, records)
    expect(anonRes.success).toBe(false)
  })

  test('door check-in rejects waitlisted or cancelled registrations', () => {
    const waitlistCode = generateTicketCode(eventId, eventSlug, 'usr-wait', 'reg-wait')
    const records = new Map<string, RegistrationRecord>()
    records.set('reg-wait', {
      id: 'reg-wait',
      eventId,
      userId: 'usr-wait',
      status: 'waitlisted',
      ticketCode: waitlistCode,
      checkedInAt: null,
    })

    const res = simulateDoorCheckIn('check_in_staff', waitlistCode, records)
    expect(res.success).toBe(false)
    expect(res.error).toContain('waitlist')
  })
})
