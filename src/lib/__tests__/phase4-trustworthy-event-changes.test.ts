import { describe, test, assert } from 'vitest'
import { InAppNotificationService } from '../notifications/service'
import type { NotificationType } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('Phase 4: InAppNotificationService Unit Tests', () => {
  test('send creates a single in-app notification record', async () => {
    const insertedRows: Array<Record<string, unknown>> = []

    const mockSupabase = {
      from(table: string) {
        assert.equal(table, 'notifications')
        return {
          insert(row: Record<string, unknown>) {
            insertedRows.push(row)
            return Promise.resolve({ error: null })
          },
        }
      },
    } as unknown as SupabaseClient

    const service = new InAppNotificationService(mockSupabase)
    const success = await service.send({
      userId: 'user-123',
      eventId: 'event-456',
      type: 'registration_confirmed',
      title: 'Registration Confirmed',
      message: 'You have registered for the Hackathon.',
      link: '/events/hackathon',
    })

    assert.equal(success, true)
    assert.equal(insertedRows.length, 1)
    const first = insertedRows[0]!
    assert.equal(first['user_id'], 'user-123')
    assert.equal(first['event_id'], 'event-456')
    assert.equal(first['type'], 'registration_confirmed')
    assert.equal(first['is_read'], false)
  })

  test('sendBatch inserts multiple notifications in a single batch', async () => {
    const insertedBatches: Array<Array<Record<string, unknown>>> = []

    const mockSupabase = {
      from(table: string) {
        assert.equal(table, 'notifications')
        return {
          insert(rows: Array<Record<string, unknown>>) {
            insertedBatches.push(rows)
            return Promise.resolve({ error: null, count: rows.length })
          },
        }
      },
    } as unknown as SupabaseClient

    const service = new InAppNotificationService(mockSupabase)
    const result = await service.sendBatch([
      {
        userId: 'user-1',
        type: 'event_cancelled',
        title: 'Event Cancelled',
        message: 'Weather concerns',
      },
      {
        userId: 'user-2',
        type: 'event_cancelled',
        title: 'Event Cancelled',
        message: 'Weather concerns',
      },
    ])

    assert.equal(result.count, 2)
    assert.equal(insertedBatches.length, 1)
    assert.equal(insertedBatches[0]!.length, 2)
  })

  test('notifyAttendees fetches active attendees and creates notifications for each', async () => {
    const insertedRows: Array<Record<string, unknown>> = []

    const mockSupabase = {
      from(table: string) {
        if (table === 'registrations') {
          return {
            select(cols: string) {
              assert.equal(cols, 'user_id')
              return {
                eq(col1: string, val1: string) {
                  assert.equal(col1, 'event_id')
                  assert.equal(val1, 'event-789')
                  return {
                    eq(col2: string, val2: string) {
                      assert.equal(col2, 'status')
                      assert.equal(val2, 'registered')
                      // Return 3 active registrations (2 distinct users)
                      return Promise.resolve({
                        data: [
                          { user_id: 'attendee-1' },
                          { user_id: 'attendee-2' },
                          { user_id: 'attendee-1' }, // duplicate to test deduplication
                        ],
                        error: null,
                      })
                    },
                  }
                },
              }
            },
          }
        }
        if (table === 'notifications') {
          return {
            insert(rows: Array<Record<string, unknown>>) {
              insertedRows.push(...rows)
              return Promise.resolve({ error: null, count: rows.length })
            },
          }
        }
        throw new Error(`Unexpected table ${table}`)
      },
    } as unknown as SupabaseClient

    const service = new InAppNotificationService(mockSupabase)
    const { recipientCount } = await service.notifyAttendees({
      eventId: 'event-789',
      type: 'event_rescheduled',
      title: 'Event Rescheduled',
      message: 'Moved to next Friday at 4 PM',
      link: '/events/demo-event',
    })

    assert.equal(recipientCount, 2, 'Deduplicates user ids and notifies 2 unique attendees')
    assert.equal(insertedRows.length, 2)
    const row0 = insertedRows[0]!
    const row1 = insertedRows[1]!
    assert.equal(row0['user_id'], 'attendee-1')
    assert.equal(row1['user_id'], 'attendee-2')
    assert.equal(row0['type'], 'event_rescheduled')
    assert.equal(row0['link'], '/events/demo-event')
  })

  test('markAsRead and markAllAsRead update is_read flag', async () => {
    let singleUpdateCalled = false
    let allUpdateCalled = false

    const mockSupabase = {
      from(table: string) {
        assert.equal(table, 'notifications')
        return {
          update(updates: Record<string, unknown>) {
            assert.equal(updates['is_read'], true)
            return {
              eq(col1: string, val1: string) {
                return {
                  eq(col2: string, _val2: string) {
                    if (col1 === 'id' && val1 === 'notif-1') {
                      singleUpdateCalled = true
                    }
                    if (col1 === 'user_id' && col2 === 'is_read') {
                      allUpdateCalled = true
                    }
                    return Promise.resolve({ error: null })
                  },
                }
              },
            }
          },
        }
      },
    } as unknown as SupabaseClient

    const service = new InAppNotificationService(mockSupabase)
    await service.markAsRead('notif-1', 'user-10')
    assert.equal(singleUpdateCalled, true)

    await service.markAllAsRead('user-10')
    assert.equal(allUpdateCalled, true)
  })
})

describe('Phase 4: Event Deletion Policy', () => {
  function checkCanDeleteEvent(event: { status: string; registration_count: number }): {
    canDelete: boolean
    error?: string
  } {
    if (event.registration_count > 0) {
      return {
        canDelete: false,
        error: `Cannot delete an event with registrations (found ${event.registration_count} registered attendees). You must Cancel the event with a reason instead to preserve attendee history.`,
      }
    }
    return { canDelete: true }
  }

  test('blocks deletion when event has registered attendees', () => {
    const result = checkCanDeleteEvent({ status: 'published', registration_count: 5 })
    assert.equal(result.canDelete, false)
    assert.match(result.error || '', /Cannot delete an event with registrations/)
    assert.match(result.error || '', /Cancel the event with a reason instead/)
  })

  test('allows deletion when event has 0 attendees', () => {
    const draftResult = checkCanDeleteEvent({ status: 'draft', registration_count: 0 })
    assert.equal(draftResult.canDelete, true)

    const publishedResult = checkCanDeleteEvent({ status: 'published', registration_count: 0 })
    assert.equal(publishedResult.canDelete, true)
  })
})

describe('Phase 4: Event Cancellation Requirements', () => {
  function validateCancellation(reason: string, currentStatus: string): {
    valid: boolean
    error?: string
  } {
    if (currentStatus === 'cancelled') {
      return { valid: false, error: 'Event is already cancelled' }
    }
    const trimmed = reason?.trim() || ''
    if (trimmed.length < 5) {
      return {
        valid: false,
        error: 'Please provide a clear cancellation reason for registered attendees (minimum 5 characters).',
      }
    }
    return { valid: true }
  }

  test('requires a cancellation reason with at least 5 characters', () => {
    assert.equal(validateCancellation('', 'published').valid, false)
    assert.equal(validateCancellation('   ', 'published').valid, false)
    assert.equal(validateCancellation('sick', 'published').valid, false)
    assert.equal(validateCancellation('Severe weather forecast; school campus is closed', 'published').valid, true)
  })

  test('prevents cancelling an already cancelled event', () => {
    const result = validateCancellation('Rescheduled for next term', 'cancelled')
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Event is already cancelled')
  })
})

describe('Phase 4: Reschedule & Venue Change Notice Requirements', () => {
  interface EventSchedule {
    event_date: string
    start_time: string
    end_time: string
    location: string
  }

  function validateEventUpdate(
    existing: EventSchedule,
    updated: EventSchedule,
    attendeeCount: number,
    changeNotice?: string
  ): {
    scheduleChanged: boolean
    locationChanged: boolean
    requiresNotice: boolean
    valid: boolean
    error?: string
    notificationType?: NotificationType
  } {
    const scheduleChanged =
      existing.event_date !== updated.event_date ||
      existing.start_time !== updated.start_time ||
      existing.end_time !== updated.end_time
    const locationChanged = existing.location !== updated.location
    const requiresNotice = attendeeCount > 0 && (scheduleChanged || locationChanged)

    const trimmedNotice = changeNotice?.trim() || ''

    if (requiresNotice && trimmedNotice.length < 5) {
      return {
        scheduleChanged,
        locationChanged,
        requiresNotice,
        valid: false,
        error: 'A change notice explaining schedule or venue changes is required when attendees are registered (minimum 5 characters).',
      }
    }

    let notificationType: NotificationType | undefined
    if (attendeeCount > 0) {
      if (scheduleChanged) notificationType = 'event_rescheduled'
      else if (locationChanged) notificationType = 'venue_changed'
    }

    return {
      scheduleChanged,
      locationChanged,
      requiresNotice,
      valid: true,
      notificationType,
    }
  }

  const baseEvent: EventSchedule = {
    event_date: '2026-10-15',
    start_time: '14:00',
    end_time: '16:00',
    location: 'Building A, Room 101',
  }

  test('requires change notice when event has attendees and date is modified', () => {
    const updated = { ...baseEvent, event_date: '2026-10-20' }
    const noNotice = validateEventUpdate(baseEvent, updated, 12, '')
    assert.equal(noNotice.valid, false)
    assert.equal(noNotice.requiresNotice, true)
    assert.match(noNotice.error || '', /change notice explaining schedule or venue changes is required/)

    const withNotice = validateEventUpdate(
      baseEvent,
      updated,
      12,
      'Postponed by one week due to midterms'
    )
    assert.equal(withNotice.valid, true)
    assert.equal(withNotice.notificationType, 'event_rescheduled')
  })

  test('requires change notice when event has attendees and venue is modified', () => {
    const updated = { ...baseEvent, location: 'Auditorium West' }
    const noNotice = validateEventUpdate(baseEvent, updated, 8, '')
    assert.equal(noNotice.valid, false)

    const withNotice = validateEventUpdate(
      baseEvent,
      updated,
      8,
      'Moved to Auditorium West to accommodate larger capacity'
    )
    assert.equal(withNotice.valid, true)
    assert.equal(withNotice.notificationType, 'venue_changed')
  })

  test('does not require change notice when event has 0 attendees', () => {
    const updated = { ...baseEvent, event_date: '2026-11-01', location: 'Virtual' }
    const result = validateEventUpdate(baseEvent, updated, 0, '')
    assert.equal(result.valid, true)
    assert.equal(result.requiresNotice, false)
    assert.equal(result.notificationType, undefined)
  })

  test('does not require change notice when only title or description changes', () => {
    const result = validateEventUpdate(baseEvent, { ...baseEvent }, 20, '')
    assert.equal(result.valid, true)
    assert.equal(result.requiresNotice, false)
    assert.equal(result.notificationType, undefined)
  })
})
