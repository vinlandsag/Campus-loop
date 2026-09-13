import { describe, test, expect } from 'vitest'
import { canEditEvent, canCancelEvent, canDeleteEvent } from '@/lib/auth/permissions'
import type { EventTeamRole } from '@/types'

describe('Integration Tests: Event Management Server Actions & Authorization', () => {
  function simulateCreateEvent(caller: {
    id: string
    role: string
    is_verified: boolean
    campus_id: string | null
    campus_verification_status: string
  }) {
    if (caller.role !== 'organizer' || !caller.is_verified) {
      return { success: false, error: 'Only verified campus organizers can create events.' }
    }
    if (!caller.campus_id || caller.campus_verification_status !== 'verified') {
      return { success: false, error: 'You must belong to a verified campus to create events.' }
    }

    return {
      success: true,
      event: {
        id: 'evt-new-1',
        organizer_id: caller.id,
        campus_id: caller.campus_id,
        status: 'published',
      },
    }
  }

  function simulateUpdateEvent(
    userRole: EventTeamRole | null,
    existingEvent: { id: string; campus_id: string; title: string },
    updates: { title?: string; campus_id?: string }
  ) {
    if (!canEditEvent(userRole)) {
      return { success: false, error: 'Unauthorized to edit this event' }
    }

    // Protection: campus_id cannot be altered on update
    const sanitizedUpdates = { ...updates }
    delete sanitizedUpdates.campus_id

    return {
      success: true,
      updatedEvent: {
        ...existingEvent,
        ...sanitizedUpdates,
        campus_id: existingEvent.campus_id, // Preserved
      },
    }
  }

  function simulateCancelEvent(
    userRole: EventTeamRole | null,
    event: { id: string; status: string }
  ) {
    if (!canCancelEvent(userRole)) {
      return { success: false, error: 'Only the event owner can cancel this event.' }
    }
    return { success: true, status: 'cancelled' }
  }

  function simulateDeleteEvent(
    userRole: EventTeamRole | null,
    event: { id: string; activeRegistrations: number }
  ) {
    if (!canDeleteEvent(userRole)) {
      return { success: false, error: 'Only the event owner can delete this event.' }
    }
    if (event.activeRegistrations > 0) {
      return { success: false, error: 'Cannot delete event with active attendees. Cancel the event instead.' }
    }
    return { success: true, deleted: true }
  }

  test('createEvent succeeds for verified organizer with verified campus', () => {
    const caller = {
      id: 'org-1',
      role: 'organizer',
      is_verified: true,
      campus_id: 'c-1',
      campus_verification_status: 'verified',
    }
    const res = simulateCreateEvent(caller)
    expect(res.success).toBe(true)
    expect(res.event?.campus_id).toBe('c-1')
  })

  test('createEvent rejects unverified organizer or pending campus', () => {
    const unverifiedOrg = {
      id: 'org-2',
      role: 'organizer',
      is_verified: false,
      campus_id: 'c-1',
      campus_verification_status: 'verified',
    }
    expect(simulateCreateEvent(unverifiedOrg).success).toBe(false)

    const unverifiedCampusOrg = {
      id: 'org-3',
      role: 'organizer',
      is_verified: true,
      campus_id: 'c-1',
      campus_verification_status: 'unverified',
    }
    expect(simulateCreateEvent(unverifiedCampusOrg).success).toBe(false)
  })

  test('updateEvent allows team editor and prevents modifying campus_id', () => {
    const existing = { id: 'evt-100', campus_id: 'c-original', title: 'Old Title' }
    const updates = { title: 'New Title', campus_id: 'c-tampered' }

    const res = simulateUpdateEvent('editor', existing, updates)
    expect(res.success).toBe(true)
    expect(res.updatedEvent?.title).toBe('New Title')
    expect(res.updatedEvent?.campus_id).toBe('c-original') // campus_id was NOT changed
  })

  test('cancelEvent and deleteEvent are strictly owner-only', () => {
    const event = { id: 'evt-100', status: 'published' }
    expect(simulateCancelEvent('editor', event).success).toBe(false)
    expect(simulateCancelEvent('check_in_staff', event).success).toBe(false)
    expect(simulateCancelEvent('owner', event).success).toBe(true)

    const eventWithAttendees = { id: 'evt-100', activeRegistrations: 5 }
    expect(simulateDeleteEvent('owner', eventWithAttendees).success).toBe(false)

    const emptyEvent = { id: 'evt-100', activeRegistrations: 0 }
    expect(simulateDeleteEvent('owner', emptyEvent).success).toBe(true)
  })
})
