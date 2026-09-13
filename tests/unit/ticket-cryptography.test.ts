import { describe, test, expect } from 'vitest'
import {
  generateTicketCode,
  verifyTicketCodeSignature,
  getTicketSecret,
} from '@/lib/tickets/service'

describe('Unit Tests: Ticket Cryptographic Signing & Timing-Attack Resistance', () => {
  const eventId = 'ev-unit-1111'
  const eventSlug = 'hack-summit'
  const userId = 'usr-unit-2222'
  const registrationId = 'reg-unit-3333'

  test('generateTicketCode produces four-segment structured ticket', () => {
    const code = generateTicketCode(eventId, eventSlug, userId, registrationId)
    const segments = code.split('-')
    expect(segments.length).toBe(4)
    expect(segments[0]).toBe('CL')
    expect(segments[1]).toBe('HACKSU')
    expect(segments[2]?.length).toBe(8)
    expect(segments[3]?.length).toBe(8)
  })

  test('verifyTicketCodeSignature validates genuine tickets and rejects altered payloads', () => {
    const validCode = generateTicketCode(eventId, eventSlug, userId, registrationId)
    expect(verifyTicketCodeSignature(validCode, eventId, userId, registrationId)).toBe(true)

    // Altered signature segment
    const parts = validCode.split('-')
    parts[3] = 'CAFEBABE'
    expect(verifyTicketCodeSignature(parts.join('-'), eventId, userId, registrationId)).toBe(false)

    // Altered event
    expect(verifyTicketCodeSignature(validCode, 'different-event-id', userId, registrationId)).toBe(false)

    // Altered user
    expect(verifyTicketCodeSignature(validCode, eventId, 'different-user-id', registrationId)).toBe(false)

    // Altered registration
    expect(verifyTicketCodeSignature(validCode, eventId, userId, 'different-reg-id')).toBe(false)
  })

  test('verifyTicketCodeSignature resists timing attacks across varying length inputs', () => {
    const validCode = generateTicketCode(eventId, eventSlug, userId, registrationId)
    const parts = validCode.split('-')

    // Short signature
    parts[3] = '12'
    expect(verifyTicketCodeSignature(parts.join('-'), eventId, userId, registrationId)).toBe(false)

    // Long signature
    parts[3] = '1234567890ABCDEF'
    expect(verifyTicketCodeSignature(parts.join('-'), eventId, userId, registrationId)).toBe(false)
  })

  test('getTicketSecret fails closed in production when secret is missing or insecure', () => {
    const originalEnv = process.env.NODE_ENV
    const originalSecret = process.env.TICKET_SIGNING_SECRET

    try {
      // @ts-expect-error mutating readonly for test
      process.env.NODE_ENV = 'production'
      delete process.env.TICKET_SIGNING_SECRET

      expect(() => getTicketSecret()).toThrow(/Ticket signing secret is missing/)

      process.env.TICKET_SIGNING_SECRET = 'campusloop-fallback-secret-2026'
      expect(() => getTicketSecret()).toThrow(/Predictable fallback secret cannot be used in production/)
    } finally {
      // @ts-expect-error restoring env
      process.env.NODE_ENV = originalEnv
      if (originalSecret !== undefined) {
        process.env.TICKET_SIGNING_SECRET = originalSecret
      } else {
        delete process.env.TICKET_SIGNING_SECRET
      }
    }
  })
})
