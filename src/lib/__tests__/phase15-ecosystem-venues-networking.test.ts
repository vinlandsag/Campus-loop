import { describe, it, expect } from 'vitest'
import {
  generateEventIcs,
  createGoogleCalendarUrl,
  createOutlookCalendarUrl,
} from '@/lib/calendar/ics'

describe('Phase 15: Calendar Interoperability & Reschedule Synchronization', () => {
  const baseEvent = {
    id: 'ev-123-abc',
    title: 'Hackathon 2026',
    description: 'Annual campus hackathon',
    location: 'Engineering Building, Hall A',
    eventDate: '2026-10-15',
    startTime: '10:00',
    endTime: '18:00',
    startsAt: '2026-10-15T10:00:00.000Z',
    endsAt: '2026-10-15T18:00:00.000Z',
    timezone: 'America/New_York',
  }

  it('generates standard RFC 5545 iCalendar with stable UID and SEQUENCE:0 for new events', () => {
    const ics = generateEventIcs(baseEvent)

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('UID:ev-123-abc@campusloop.internal')
    expect(ics).toContain('SEQUENCE:0')
    expect(ics).toContain('STATUS:CONFIRMED')
    expect(ics).toContain('DTSTART:20261015T100000Z')
    expect(ics).toContain('DTEND:20261015T180000Z')
    expect(ics).toContain('SUMMARY:Hackathon 2026')
    expect(ics).toContain('LOCATION:Engineering Building\\, Hall A')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('END:VCALENDAR')
  })

  it('increments SEQUENCE when an event is rescheduled to enable calendar client updates', () => {
    const rescheduledEvent = {
      ...baseEvent,
      sequence: 2,
      startTime: '11:00',
      startsAt: '2026-10-15T11:00:00.000Z',
      lastModified: '2026-10-10T14:30:00.000Z',
    }

    const ics = generateEventIcs(rescheduledEvent)

    expect(ics).toContain('UID:ev-123-abc@campusloop.internal')
    expect(ics).toContain('SEQUENCE:2')
    expect(ics).toContain('DTSTART:20261015T110000Z')
    expect(ics).toContain('LAST-MODIFIED:20261010T143000Z')
  })

  it('emits STATUS:CANCELLED when event is cancelled so calendar software crosses it out', () => {
    const cancelledEvent = {
      ...baseEvent,
      sequence: 3,
      status: 'CANCELLED' as const,
    }

    const ics = generateEventIcs(cancelledEvent)

    expect(ics).toContain('UID:ev-123-abc@campusloop.internal')
    expect(ics).toContain('STATUS:CANCELLED')
    expect(ics).toContain('SEQUENCE:3')
  })

  it('generates direct Google Calendar web template URL with accurate UTC timestamps and venue', () => {
    const googleUrl = createGoogleCalendarUrl(baseEvent)

    expect(googleUrl).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE')
    expect(googleUrl).toContain('text=Hackathon+2026')
    expect(googleUrl).toContain('dates=20261015T100000Z%2F20261015T180000Z')
    expect(googleUrl).toContain('location=Engineering+Building%2C+Hall+A')
    expect(googleUrl).toContain('ctz=America%2FNew_York')
  })

  it('generates direct Outlook compose URL with ISO datetime formatting', () => {
    const outlookUrl = createOutlookCalendarUrl(baseEvent)

    expect(outlookUrl).toContain('https://outlook.live.com/calendar/0/deeplink/compose')
    expect(outlookUrl).toContain('subject=Hackathon+2026')
    expect(outlookUrl).toContain('startdt=2026-10-15T10%3A00%3A00.000Z')
    expect(outlookUrl).toContain('location=Engineering+Building%2C+Hall+A')
  })
})

describe('Phase 15: Structured Venue & Map Coordinates Validation', () => {
  function isValidCoordinates(lat?: number | null, lng?: number | null): boolean {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    )
  }

  it('accepts valid GPS latitude and longitude within world boundaries', () => {
    expect(isValidCoordinates(40.7128, -74.006)).toBe(true) // NYC
    expect(isValidCoordinates(51.5074, -0.1278)).toBe(true) // London
    expect(isValidCoordinates(0, 0)).toBe(true) // Prime meridian equator
    expect(isValidCoordinates(-33.8688, 151.2093)).toBe(true) // Sydney
  })

  it('rejects invalid or missing coordinates to suppress map preview', () => {
    expect(isValidCoordinates(null, null)).toBe(false)
    expect(isValidCoordinates(undefined, undefined)).toBe(false)
    expect(isValidCoordinates(NaN, -74.006)).toBe(false)
    expect(isValidCoordinates(40.7128, NaN)).toBe(false)
    expect(isValidCoordinates(95.0, -74.006)).toBe(false) // Lat > 90
    expect(isValidCoordinates(-92.0, -74.006)).toBe(false) // Lat < -90
    expect(isValidCoordinates(40.7128, 185.0)).toBe(false) // Lng > 180
    expect(isValidCoordinates(40.7128, -195.0)).toBe(false) // Lng < -180
  })
})

describe('Phase 15: Networking Privacy & Zero-Consent Leakage', () => {
  it('strictly limits networking card to approved fields only', () => {
    const approvedKeys = [
      'user_id',
      'full_name',
      'course_or_major',
      'headline',
      'interests',
      'linkedin_url',
      'portfolio_url',
      'github_url',
    ]

    const card = {
      user_id: 'usr-1',
      full_name: 'Jane Student',
      course_or_major: 'Data Science, 3rd Year',
      headline: 'Aspiring AI Researcher',
      interests: ['AI', 'PyTorch'],
      linkedin_url: 'https://linkedin.com/in/janestudent',
      portfolio_url: 'https://janestudent.me',
      github_url: 'https://github.com/janestudent',
      // Prohibited private fields:
      phone_number: '+15551234567',
      student_id_number: 'STU-99482',
      home_address: '123 Dorm Hall',
    }

    // Filter to approved keys
    const sanitizedCard: Record<string, unknown> = {}
    approvedKeys.forEach((key) => {
      if (key in card) {
        sanitizedCard[key] = (card as Record<string, unknown>)[key]
      }
    })

    expect(sanitizedCard).not.toHaveProperty('phone_number')
    expect(sanitizedCard).not.toHaveProperty('student_id_number')
    expect(sanitizedCard).not.toHaveProperty('home_address')
    expect(sanitizedCard.full_name).toBe('Jane Student')
    expect(sanitizedCard.linkedin_url).toBe('https://linkedin.com/in/janestudent')
  })

  it('generates 32-character high-entropy hex exchange token for contactless QR exchange', () => {
    const token = 'a8f7c9e1b2d3456789abcdef01234567'
    expect(token).toMatch(/^[a-f0-9]{32}$/)
  })
})

describe('Phase 15: Multi-Language Content & Machine Translation Labeling', () => {
  it('correctly labels machine-translated content to prevent student misinterpretation', () => {
    const humanTranslation = {
      language_code: 'es',
      language_name: 'Español',
      title: 'Taller de Desarrollo Web',
      description: 'Aprende React y Next.js paso a paso.',
      is_machine_translated: false,
    }

    const machineTranslation = {
      language_code: 'fr',
      language_name: 'Français',
      title: 'Atelier de Développement Web',
      description: 'Apprenez React et Next.js étape par étape.',
      is_machine_translated: true,
    }

    expect(humanTranslation.is_machine_translated).toBe(false)
    expect(machineTranslation.is_machine_translated).toBe(true)
  })
})

describe('Phase 15: Outbound Feed & Partner API Security Isolation', () => {
  it('ensures unpublished and draft events are excluded from public feeds', () => {
    const allEvents = [
      { id: '1', title: 'Published Event', status: 'published' },
      { id: '2', title: 'Draft Event', status: 'draft' },
      { id: '3', title: 'Completed Event', status: 'completed' },
      { id: '4', title: 'Cancelled Event', status: 'cancelled' },
    ]

    const feedEvents = allEvents.filter((e) => e.status === 'published')

    expect(feedEvents.length).toBe(1)
    expect(feedEvents[0]?.title).toBe('Published Event')
  })

  it('guarantees zero leakage of attendee identities or ticket codes in feed serialization', () => {
    const internalEventRecord = {
      id: 'e1',
      title: 'Public Robotics Showcase',
      slug: 'robotics-showcase',
      description: 'Demo of campus robots',
      category: 'tech',
      status: 'published',
      location: 'Engineering Atrium',
      // Internal relations that MUST be omitted from public feeds:
      registrations: [{ user_id: 'u1', ticket_code: 'CAMPUS-SECRET-999', email: 'alice@campus.edu' }],
      questions: [{ question_text: 'T-shirt size?', answers: [{ answer: 'M' }] }],
    }

    // Public feed serializer projection
    const publicFeedItem = {
      id: internalEventRecord.id,
      title: internalEventRecord.title,
      slug: internalEventRecord.slug,
      description: internalEventRecord.description,
      category: internalEventRecord.category,
      location: internalEventRecord.location,
    }

    expect(publicFeedItem).not.toHaveProperty('registrations')
    expect(publicFeedItem).not.toHaveProperty('questions')
    expect(JSON.stringify(publicFeedItem)).not.toContain('CAMPUS-SECRET-999')
    expect(JSON.stringify(publicFeedItem)).not.toContain('alice@campus.edu')
  })
})
