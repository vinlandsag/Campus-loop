import { describe, test, expect } from 'vitest'
import {
  NullEmailProvider,
  RestEmailProvider,
  EmailDeliveryService,
} from '@/lib/email/service'
import { generateEventIcs } from '@/lib/calendar/ics'
import type { IEmailProvider, EmailMessage, EmailSendResult } from '@/lib/email/types'

describe('Phase 10: Provider-Agnostic Email Service & Delivery Honesty', () => {
  test('NullEmailProvider returns skipped_no_provider and does not pretend email was sent', async () => {
    const provider = new NullEmailProvider()
    expect(provider.isConfigured()).toBe(false)

    const result = await provider.sendEmail({
      to: 'student@university.edu',
      subject: 'Event Confirmation',
      text: 'You are registered!',
    })

    expect(result.success).toBe(false)
    expect(result.status).toBe('skipped_no_provider')
    expect(result.provider).toBe('none')
    expect(result.error).toContain('No production email provider configured')
  })

  test('EmailDeliveryService defaults to NullEmailProvider when credentials are absent', async () => {
    const originalKey = process.env['RESEND_API_KEY']
    delete process.env['RESEND_API_KEY']
    delete process.env['EMAIL_PROVIDER_API_KEY']

    const service = new EmailDeliveryService()
    expect(service.isConfigured()).toBe(false)

    const result = await service.send({
      to: 'attendee@campus.edu',
      subject: 'Reminder: Hackathon Tomorrow',
      text: 'See you there!',
    })

    expect(result.status).toBe('skipped_no_provider')
    expect(result.success).toBe(false)

    if (originalKey) process.env['RESEND_API_KEY'] = originalKey
  })

  test('EmailDeliveryService uses pluggable provider when registered', async () => {
    class MockCustomProvider implements IEmailProvider {
      readonly name = 'custom_campus_smtp'
      public sentMessages: EmailMessage[] = []

      isConfigured() {
        return true
      }

      async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
        this.sentMessages.push(message)
        return {
          success: true,
          status: 'sent',
          provider: this.name,
          messageId: 'mock-12345',
          sentAt: new Date().toISOString(),
        }
      }
    }

    const mock = new MockCustomProvider()
    const service = new EmailDeliveryService(mock)

    expect(service.isConfigured()).toBe(true)

    const result = await service.send({
      to: 'student@mit.edu',
      subject: 'Welcome to Hackathon',
      text: 'Registration confirmed.',
    })

    expect(result.success).toBe(true)
    expect(result.status).toBe('sent')
    expect(result.provider).toBe('custom_campus_smtp')
    expect(mock.sentMessages.length).toBe(1)
    expect(mock.sentMessages[0]?.to).toBe('student@mit.edu')
  })

  test('EmailDeliveryService rejects malformed or missing recipient address', async () => {
    const provider = new NullEmailProvider()
    const service = new EmailDeliveryService(provider)

    const result = await service.send({
      to: 'invalid-email',
      subject: 'Subject',
      text: 'Body',
    })

    expect(result.success).toBe(false)
    expect(result.status).toBe('failed')
    expect(result.error).toContain('Invalid recipient')
  })
})

describe('Phase 10: Calendar Attachment (.ics) RFC 5545 Compliance', () => {
  test('generateEventIcs produces valid VCALENDAR format with correct metadata', () => {
    const ics = generateEventIcs({
      id: 'event-uuid-101',
      title: 'Annual Campus Hackathon, 2026; Edition',
      description: 'Join us for 48 hours of building!\nBring laptops and chargers.',
      location: 'Student Union Ballroom, Room 302',
      eventDate: '2026-10-15',
      startTime: '10:00',
      endTime: '18:00',
      organizerName: 'Tech Club',
      organizerEmail: 'contact@techclub.org',
    })

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('PRODID:-//CampusLoop//EventHub//EN')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('UID:event-uuid-101@campusloop.internal')
    expect(ics).toContain('DTSTART:20261015T100000')
    expect(ics).toContain('DTEND:20261015T180000')
    expect(ics).toContain('SUMMARY:Annual Campus Hackathon\\, 2026\\; Edition')
    expect(ics).toContain('LOCATION:Student Union Ballroom\\, Room 302')
    expect(ics).toContain('STATUS:CONFIRMED')
    expect(ics).toContain('ORGANIZER;CN=Tech Club:mailto:contact@techclub.org')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('END:VCALENDAR')
  })
})
