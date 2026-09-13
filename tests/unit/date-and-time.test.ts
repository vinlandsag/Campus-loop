import { describe, test, expect } from 'vitest'
import { isEventPast, getEventEndDateTime } from '@/lib/utils/date'

describe('Unit Tests: Date, Time & Deadline Utilities', () => {
  test('isEventPast returns false for future event dates', () => {
    const futureDate = new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0] as string
    const event = {
      event_date: futureDate,
      start_time: '14:00',
      end_time: '16:00',
      timezone: 'America/Los_Angeles',
    }
    expect(isEventPast(event)).toBe(false)
  })

  test('isEventPast returns true for dates firmly in the past', () => {
    const pastDate = '2020-01-01'
    const event = {
      event_date: pastDate,
      start_time: '10:00',
      end_time: '12:00',
      timezone: 'America/Los_Angeles',
    }
    expect(isEventPast(event)).toBe(true)
  })

  test('isEventPast respects event end time and reference date', () => {
    const event = {
      event_date: '2026-10-15',
      end_time: '14:00:00',
      timezone: 'UTC',
    }

    // Reference time before end
    const beforeEnd = new Date('2026-10-15T13:00:00Z')
    expect(isEventPast(event, beforeEnd)).toBe(false)

    // Reference time after end
    const afterEnd = new Date('2026-10-15T15:00:00Z')
    expect(isEventPast(event, afterEnd)).toBe(true)
  })

  test('getEventEndDateTime constructs accurate Date object', () => {
    const endDate = getEventEndDateTime('2026-10-15', '12:30:00', 'UTC')
    expect(endDate.toISOString()).toBe('2026-10-15T12:30:00.000Z')
  })
})

