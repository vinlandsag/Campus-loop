import { describe, test, expect } from 'vitest'
import { generateTicketCode, verifyTicketCodeSignature } from '@/lib/tickets/service'
import { canCheckIn } from '@/lib/auth/permissions'

describe('End-to-End Tests: Critical Registration, Capacity, Waitlist & Check-In Lifecycle', () => {
  interface EventState {
    id: string
    slug: string
    title: string
    capacity: number
    activeCount: number
    registrationDeadline: string
  }

  interface Registration {
    id: string
    eventId: string
    userId: string
    status: 'registered' | 'waitlisted' | 'cancelled' | 'checked_in'
    ticketCode: string | null
    waitlistPosition: number | null
    registeredAt: string
    checkedInAt: string | null
  }

  // Pure simulation of atomic PostgreSQL RPC operations:
  // register_for_event, cancel_registration, and check_in_attendee
  class EventLifecycleSimulator {
    event: EventState
    registrations: Map<string, Registration> = new Map()

    constructor(capacity: number, deadlineIso: string) {
      this.event = {
        id: 'evt-e2e-1',
        slug: 'annual-hackathon-2026',
        title: 'Annual Campus Hackathon 2026',
        capacity,
        activeCount: 0,
        registrationDeadline: deadlineIso,
      }
    }

    register(userId: string): { success: boolean; status?: string; ticketCode?: string; waitlistPosition?: number; error?: string } {
      // 1. Deadline check
      if (new Date() > new Date(this.event.registrationDeadline)) {
        return { success: false, error: 'Registration deadline has passed.' }
      }

      // Check existing active
      for (const reg of this.registrations.values()) {
        if (reg.userId === userId && (reg.status === 'registered' || reg.status === 'waitlisted' || reg.status === 'checked_in')) {
          return { success: false, error: 'User is already registered for this event.' }
        }
      }

      const regId = `reg-${userId}`
      const now = new Date().toISOString()

      // 2. Capacity check
      if (this.event.activeCount < this.event.capacity) {
        // Space available -> register with cryptographic ticket
        const ticketCode = generateTicketCode(this.event.id, this.event.slug, userId, regId)
        this.event.activeCount += 1
        const reg: Registration = {
          id: regId,
          eventId: this.event.id,
          userId,
          status: 'registered',
          ticketCode,
          waitlistPosition: null,
          registeredAt: now,
          checkedInAt: null,
        }
        this.registrations.set(regId, reg)
        return { success: true, status: 'registered', ticketCode }
      } else {
        // Event full -> overflow to FIFO waitlist
        const currentWaitlistCount = Array.from(this.registrations.values()).filter((r) => r.status === 'waitlisted').length
        const position = currentWaitlistCount + 1
        const reg: Registration = {
          id: regId,
          eventId: this.event.id,
          userId,
          status: 'waitlisted',
          ticketCode: null,
          waitlistPosition: position,
          registeredAt: now,
          checkedInAt: null,
        }
        this.registrations.set(regId, reg)
        return { success: true, status: 'waitlisted', waitlistPosition: position }
      }
    }

    cancel(userId: string): { success: boolean; promotedUserId?: string } {
      const reg = Array.from(this.registrations.values()).find((r) => r.userId === userId && (r.status === 'registered' || r.status === 'waitlisted'))
      if (!reg) return { success: false }

      const wasActive = reg.status === 'registered'
      reg.status = 'cancelled'
      reg.ticketCode = null
      reg.waitlistPosition = null

      let promotedUserId: string | undefined

      if (wasActive) {
        // Atomic promotion: find earliest waitlisted (FIFO)
        const waitlist = Array.from(this.registrations.values())
          .filter((r) => r.status === 'waitlisted')
          .sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime())

        if (waitlist.length > 0) {
          const toPromote = waitlist[0]!
          toPromote.status = 'registered'
          toPromote.waitlistPosition = null
          toPromote.ticketCode = generateTicketCode(this.event.id, this.event.slug, toPromote.userId, toPromote.id)
          promotedUserId = toPromote.userId
          // activeCount remains unchanged because 1 left and 1 promoted
        } else {
          this.event.activeCount -= 1
        }
      }

      // Resequence remaining waitlist
      const remainingWaitlist = Array.from(this.registrations.values())
        .filter((r) => r.status === 'waitlisted')
        .sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime())

      remainingWaitlist.forEach((r, idx) => {
        r.waitlistPosition = idx + 1
      })

      return { success: true, promotedUserId }
    }

    checkIn(ticketCode: string, staffRole: string): { success: boolean; alreadyCheckedIn?: boolean; error?: string } {
      if (!canCheckIn(staffRole as any)) {
        return { success: false, error: 'Unauthorized staff role' }
      }

      const reg = Array.from(this.registrations.values()).find((r) => r.ticketCode === ticketCode)
      if (!reg) {
        return { success: false, error: 'Invalid ticket code' }
      }

      // Cryptographic signature verification
      if (!verifyTicketCodeSignature(ticketCode, reg.eventId, reg.userId, reg.id)) {
        return { success: false, error: 'Ticket cryptographic signature verification failed' }
      }

      if (reg.status === 'checked_in') {
        return { success: true, alreadyCheckedIn: true }
      }

      if (reg.status !== 'registered') {
        return { success: false, error: `Cannot check in attendee with status ${reg.status}` }
      }

      reg.status = 'checked_in'
      reg.checkedInAt = new Date().toISOString()
      return { success: true, alreadyCheckedIn: false }
    }
  }

  test('complete critical lifecycle: capacity bounding, waitlist overflow, FIFO promotion, and check-in', () => {
    // Capacity = 2, deadline tomorrow
    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    const sim = new EventLifecycleSimulator(2, tomorrow)

    // 1. First two attendees fill capacity
    const reg1 = sim.register('student-alice')
    expect(reg1.success).toBe(true)
    expect(reg1.status).toBe('registered')
    expect(reg1.ticketCode).toBeDefined()
    expect(sim.event.activeCount).toBe(1)

    const reg2 = sim.register('student-bob')
    expect(reg2.success).toBe(true)
    expect(reg2.status).toBe('registered')
    expect(reg2.ticketCode).toBeDefined()
    expect(sim.event.activeCount).toBe(2)

    // 2. Third and fourth attendees overflow to fair waitlist
    const reg3 = sim.register('student-charlie')
    expect(reg3.success).toBe(true)
    expect(reg3.status).toBe('waitlisted')
    expect(reg3.waitlistPosition).toBe(1)

    const reg4 = sim.register('student-dana')
    expect(reg4.success).toBe(true)
    expect(reg4.status).toBe('waitlisted')
    expect(reg4.waitlistPosition).toBe(2)

    // 3. Alice cancels -> Charlie is atomically promoted with new ticket, Dana becomes waitlist #1
    const cancelRes = sim.cancel('student-alice')
    expect(cancelRes.success).toBe(true)
    expect(cancelRes.promotedUserId).toBe('student-charlie')

    const charlieRecord = sim.registrations.get('reg-student-charlie')
    expect(charlieRecord?.status).toBe('registered')
    expect(charlieRecord?.waitlistPosition).toBeNull()
    expect(charlieRecord?.ticketCode).toBeDefined()

    const danaRecord = sim.registrations.get('reg-student-dana')
    expect(danaRecord?.status).toBe('waitlisted')
    expect(danaRecord?.waitlistPosition).toBe(1) // Resequenced from #2 to #1

    // 4. Bob arrives at door and checks in via ticket scanner
    const bobRecord = sim.registrations.get('reg-student-bob')
    const checkIn1 = sim.checkIn(bobRecord!.ticketCode!, 'check_in_staff')
    expect(checkIn1.success).toBe(true)
    expect(checkIn1.alreadyCheckedIn).toBe(false)
    expect(bobRecord?.status).toBe('checked_in')

    // 5. Scanning Bob's ticket a second time is idempotent
    const checkInDuplicate = sim.checkIn(bobRecord!.ticketCode!, 'check_in_staff')
    expect(checkInDuplicate.success).toBe(true)
    expect(checkInDuplicate.alreadyCheckedIn).toBe(true)

    // 6. Charlie also arrives and checks in successfully
    const checkInCharlie = sim.checkIn(charlieRecord!.ticketCode!, 'check_in_staff')
    expect(checkInCharlie.success).toBe(true)
    expect(checkInCharlie.alreadyCheckedIn).toBe(false)
    expect(charlieRecord?.status).toBe('checked_in')
  })

  test('registration deadline strictly rejects registrations after expiration', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const sim = new EventLifecycleSimulator(10, yesterday)

    const res = sim.register('late-student')
    expect(res.success).toBe(false)
    expect(res.error).toContain('deadline')
  })
})
