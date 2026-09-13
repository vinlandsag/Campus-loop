import { describe, test, assert } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  generateTicketCode,
  verifyTicketCodeSignature,
  generateTicketQRCodeSvg,
  generateTicketQRCodeDataUrl,
  buildTicketData,
} from '../tickets/service'

describe('Phase 5: Ticket Generation & Cryptographic Security', () => {
  const eventId = 'ev-1111-2222-3333'
  const eventSlug = 'ai-hackathon-2026'
  const userId = 'usr-aaaa-bbbb-cccc'
  const regId = 'reg-9999-8888-7777'

  test('generateTicketCode produces valid CL-[SLUG]-[REGID]-[SIG] format', () => {
    const code = generateTicketCode(eventId, eventSlug, userId, regId)

    assert.ok(code.startsWith('CL-'), 'Code must start with CL- prefix')
    const parts = code.split('-')
    assert.equal(parts.length, 4, 'Code must have 4 hyphen-separated parts')
    assert.equal(parts[0], 'CL')
    assert.equal(parts[1], 'AIHACK') // slug clean 6 chars
    assert.equal(parts[2], 'REG99998') // first 8 chars of regId
    assert.equal(parts[3]?.length, 8) // 8-char HMAC signature
  })

  test('generateTicketCode is deterministic for identical inputs', () => {
    const code1 = generateTicketCode(eventId, eventSlug, userId, regId)
    const code2 = generateTicketCode(eventId, eventSlug, userId, regId)

    assert.equal(code1, code2, 'Regenerating ticket for the same attendee & registration must be identical')
  })

  test('generateTicketCode produces unique codes for different attendees or events', () => {
    const codeA = generateTicketCode(eventId, eventSlug, 'usr-1', regId)
    const codeB = generateTicketCode(eventId, eventSlug, 'usr-2', regId)
    const codeC = generateTicketCode('different-event-id', eventSlug, userId, regId)

    assert.notEqual(codeA, codeB, 'Different users must have distinct ticket codes')
    assert.notEqual(codeA, codeC, 'Different events must have distinct ticket codes')
  })

  test('verifyTicketCodeSignature accepts authentic tickets and rejects tampered tickets', () => {
    const validCode = generateTicketCode(eventId, eventSlug, userId, regId)

    // Authentic ticket
    const isValid = verifyTicketCodeSignature(validCode, eventId, userId, regId)
    assert.equal(isValid, true, 'Valid ticket code must verify successfully')

    // Tampered signature
    const tamperedCode = validCode.slice(0, -2) + 'XX'
    const isTamperedValid = verifyTicketCodeSignature(tamperedCode, eventId, userId, regId)
    assert.equal(isTamperedValid, false, 'Tampered signature must fail verification')

    // Presented at wrong event
    const isCrossEventValid = verifyTicketCodeSignature(validCode, 'different-event-id', userId, regId)
    assert.equal(isCrossEventValid, false, 'Ticket presented for wrong event must fail signature check')
  })
})

describe('Phase 5: QR Code Generation', () => {
  const code = 'CL-AIHACK-REG99998-A1B2C3D4'

  test('generateTicketQRCodeSvg generates valid SVG markup', async () => {
    const svg = await generateTicketQRCodeSvg(code)

    assert.ok(svg.includes('<svg'), 'QR code must include opening <svg tag')
    assert.ok(svg.includes('</svg>'), 'QR code must include closing </svg> tag')
    assert.ok(svg.includes('<path'), 'QR code must contain SVG paths')
  })

  test('generateTicketQRCodeDataUrl returns base64 PNG data URL', async () => {
    const dataUrl = await generateTicketQRCodeDataUrl(code)

    assert.ok(dataUrl.startsWith('data:image/png;base64,'), 'QR data URL must start with png data url prefix')
    assert.ok(dataUrl.length > 100, 'QR data URL must contain valid base64 data')
  })

  test('buildTicketData compiles full ticket object with QR code', async () => {
    const ticket = await buildTicketData({
      eventId: 'ev-100',
      eventSlug: 'spring-fest',
      eventTitle: 'Spring Festival 2026',
      eventStartsAt: 'October 15, 2026 • 10:00 AM',
      eventLocation: 'Campus Quad',
      campusName: 'Main Campus',
      studentId: 'student-42',
      attendeeName: 'Alex River',
      registrationId: 'reg-uuid-1234-5678',
      status: 'registered',
    })

    assert.equal(ticket.eventTitle, 'Spring Festival 2026')
    assert.equal(ticket.attendeeName, 'Alex River')
    assert.equal(ticket.status, 'registered')
    assert.ok(ticket.ticketCode.startsWith('CL-SPRING-'), 'Ticket code should have prefix CL-SPRING-')
    assert.ok(ticket.qrSvg && ticket.qrSvg.includes('<svg'), 'Ticket must have embedded QR SVG')
    assert.ok(ticket.qrDataUrl && ticket.qrDataUrl.startsWith('data:image/png;base64,'), 'Ticket must have QR data URL')
  })
})

describe('Phase 5: Fair Waitlist Ordering & FIFO Promotion Simulation', () => {
  interface SimRegistration {
    id: string
    userId: string
    eventId: string
    status: 'registered' | 'waitlisted' | 'cancelled' | 'checked_in'
    registeredAt: string
    ticketCode?: string
  }

  test('Waitlist orders attendees strictly by registered_at ASC (FIFO)', () => {
    const waitlist: SimRegistration[] = [
      { id: 'reg-3', userId: 'user-3', eventId: 'event-1', status: 'waitlisted', registeredAt: '2026-09-10T12:00:00Z' },
      { id: 'reg-1', userId: 'user-1', eventId: 'event-1', status: 'waitlisted', registeredAt: '2026-09-10T10:00:00Z' },
      { id: 'reg-2', userId: 'user-2', eventId: 'event-1', status: 'waitlisted', registeredAt: '2026-09-10T11:00:00Z' },
    ]

    // FIFO sort
    const sorted = [...waitlist].sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime())

    assert.equal(sorted[0]?.id, 'reg-1', 'Earliest registrant must be #1 in line')
    assert.equal(sorted[1]?.id, 'reg-2', 'Second registrant must be #2 in line')
    assert.equal(sorted[2]?.id, 'reg-3', 'Third registrant must be #3 in line')
  })

  test('Promoting from waitlist targets the earliest attendee and marks status registered', () => {
    const registrations: SimRegistration[] = [
      { id: 'reg-reg1', userId: 'user-orig', eventId: 'event-1', status: 'registered', registeredAt: '2026-09-01T08:00:00Z' },
      { id: 'reg-wait1', userId: 'user-next', eventId: 'event-1', status: 'waitlisted', registeredAt: '2026-09-10T10:00:00Z' },
      { id: 'reg-wait2', userId: 'user-later', eventId: 'event-1', status: 'waitlisted', registeredAt: '2026-09-10T10:30:00Z' },
    ]

    // Attendee cancels
    const active = registrations.find((r) => r.id === 'reg-reg1')!
    active.status = 'cancelled'

    // FIFO promotion algorithm
    const waitlisted = registrations
      .filter((r) => r.status === 'waitlisted')
      .sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime())

    assert.ok(waitlisted.length > 0, 'Should find waitlisted candidates')
    const nextInLine = waitlisted[0]!
    assert.equal(nextInLine.id, 'reg-wait1', 'First waitlisted attendee must be selected for promotion')

    // Promote
    nextInLine.status = 'registered'
    nextInLine.ticketCode = generateTicketCode('event-1', 'event-slug', nextInLine.userId, nextInLine.id)

    assert.equal(nextInLine.status, 'registered')
    assert.ok(nextInLine.ticketCode.startsWith('CL-'), 'Promoted attendee receives a valid ticket code')

    // Subsequent promotion would target user-later
    const remainingWaitlist = registrations.filter((r) => r.status === 'waitlisted')
    assert.equal(remainingWaitlist.length, 1)
    assert.equal(remainingWaitlist[0]?.id, 'reg-wait2')
  })
})

describe('Phase 5: Idempotent Check-In & Anti-Fraud Logic', () => {
  interface MockRegRecord {
    id: string
    eventId: string
    userId: string
    status: 'registered' | 'waitlisted' | 'cancelled' | 'checked_in'
    checkedInAt?: string | null
    ticketCode: string
  }

  function simulateCheckIn(
    scannedEventId: string,
    scannedCode: string,
    database: MockRegRecord[]
  ) {
    const reg = database.find((r) => r.ticketCode === scannedCode)

    if (!reg) {
      return { success: false, error: 'Invalid or unrecognized ticket code.' }
    }

    if (reg.eventId !== scannedEventId) {
      return { success: false, error: 'This ticket belongs to a different event.' }
    }

    if (reg.status === 'cancelled') {
      return { success: false, error: 'This registration has been cancelled.' }
    }

    if (reg.status === 'waitlisted') {
      return { success: false, error: 'Attendee is currently on the waitlist, not admitted yet.' }
    }

    if (reg.status === 'checked_in' || reg.checkedInAt) {
      return {
        success: true,
        alreadyCheckedIn: true,
        checkedInAt: reg.checkedInAt,
      }
    }

    // Record check in
    const checkInTime = new Date().toISOString()
    reg.status = 'checked_in'
    reg.checkedInAt = checkInTime

    return {
      success: true,
      alreadyCheckedIn: false,
      checkedInAt: checkInTime,
    }
  }

  test('First scan checks attendee in; second scan reports already checked in (idempotent)', () => {
    const db: MockRegRecord[] = [
      {
        id: 'reg-abc',
        eventId: 'event-hackathon',
        userId: 'user-1',
        status: 'registered',
        ticketCode: 'CL-HACK26-REGABC12-12345678',
      },
    ]

    // 1st scan
    const scan1 = simulateCheckIn('event-hackathon', 'CL-HACK26-REGABC12-12345678', db)
    assert.equal(scan1.success, true)
    assert.equal(scan1.alreadyCheckedIn, false)
    assert.ok(scan1.checkedInAt)

    // 2nd scan of same ticket
    const scan2 = simulateCheckIn('event-hackathon', 'CL-HACK26-REGABC12-12345678', db)
    assert.equal(scan2.success, true)
    assert.equal(scan2.alreadyCheckedIn, true)
    assert.equal(scan2.checkedInAt, scan1.checkedInAt, 'Recorded timestamp must be preserved')
  })

  test('Cross-event ticket scan is rejected with event mismatch error', () => {
    const db: MockRegRecord[] = [
      {
        id: 'reg-xyz',
        eventId: 'event-science-fair',
        userId: 'user-2',
        status: 'registered',
        ticketCode: 'CL-SCFAIR-REGXYZ99-98765432',
      },
    ]

    // Present science fair ticket at hackathon event
    const scanResult = simulateCheckIn('event-hackathon', 'CL-SCFAIR-REGXYZ99-98765432', db)
    assert.equal(scanResult.success, false)
    assert.ok(scanResult.error?.includes('different event'), 'Must reject cross-event ticket')
  })

  test('Cancelled registration cannot be checked in', () => {
    const db: MockRegRecord[] = [
      {
        id: 'reg-cancelled',
        eventId: 'event-hackathon',
        userId: 'user-3',
        status: 'cancelled',
        ticketCode: 'CL-HACK26-REGCANC1-11223344',
      },
    ]

    const scanResult = simulateCheckIn('event-hackathon', 'CL-HACK26-REGCANC1-11223344', db)
    assert.equal(scanResult.success, false)
    assert.ok(scanResult.error?.includes('cancelled'))
  })

  test('Waitlisted attendee cannot be checked in before being promoted', () => {
    const db: MockRegRecord[] = [
      {
        id: 'reg-waitlisted',
        eventId: 'event-hackathon',
        userId: 'user-4',
        status: 'waitlisted',
        ticketCode: 'CL-HACK26-REGWAIT1-55667788',
      },
    ]

    const scanResult = simulateCheckIn('event-hackathon', 'CL-HACK26-REGWAIT1-55667788', db)
    assert.equal(scanResult.success, false)
    assert.ok(scanResult.error?.includes('waitlist'))
  })
})

describe('Phase 5: Migration File Integrity', () => {
  test('Phase 5 migration files exist and define transactional enum & schema additions', () => {
    const enumMigrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260910225000_phase5_add_waitlist_status_enum.sql'
    )
    const schemaMigrationPath = path.join(
      process.cwd(),
      'supabase/migrations/20260910230000_phase5_waitlist_tickets_checkin.sql'
    )
    assert.ok(fs.existsSync(enumMigrationPath), 'Enum migration file must exist on disk')
    assert.ok(fs.existsSync(schemaMigrationPath), 'Schema migration file must exist on disk')

    const enumSql = fs.readFileSync(enumMigrationPath, 'utf8')
    assert.ok(enumSql.includes("ADD VALUE IF NOT EXISTS 'waitlisted'"), 'Enum migration must add waitlisted')
    assert.ok(enumSql.includes("ADD VALUE IF NOT EXISTS 'checked_in'"), 'Enum migration must add checked_in')

    const schemaSql = fs.readFileSync(schemaMigrationPath, 'utf8')
    assert.ok(schemaSql.includes('ticket_code'), 'SQL must add ticket_code column')
    assert.ok(schemaSql.includes('checked_in_at'), 'SQL must add checked_in_at column')
    assert.ok(schemaSql.includes('promote_next_waitlisted_attendee'), 'SQL must define waitlist promotion procedure')
    assert.ok(schemaSql.includes('check_in_attendee'), 'SQL must define idempotent check_in_attendee function')
  })
})

