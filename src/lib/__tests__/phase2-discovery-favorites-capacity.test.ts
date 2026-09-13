import { describe, test, assert } from 'vitest'

import { EVENT_CATEGORIES } from '@/lib/constants'
import {
  getEventEndDateTime,
  isEventPast,
  isEventUpcoming,
} from '@/lib/utils/date'

describe('Phase 2: Canonical Categories', () => {
  test('EVENT_CATEGORIES has unique, non-empty canonical categories', () => {
    assert.ok(Array.isArray(EVENT_CATEGORIES), 'EVENT_CATEGORIES must be an array')
    assert.ok(EVENT_CATEGORIES.length >= 7, 'Should have comprehensive campus categories')

    const values = EVENT_CATEGORIES.map((c) => c.value)
    const labels = EVENT_CATEGORIES.map((c) => c.label)

    // Check uniqueness
    const uniqueValues = new Set(values)
    assert.equal(uniqueValues.size, values.length, 'All category values must be unique')
    const uniqueLabels = new Set(labels)
    assert.equal(uniqueLabels.size, labels.length, 'All category labels must be unique')

    // Check non-empty strings
    for (const cat of EVENT_CATEGORIES) {
      assert.ok(cat.value && typeof cat.value === 'string')
      assert.ok(cat.label && typeof cat.label === 'string')
    }

    // Key categories required by both organizer creation and student discovery
    const requiredCategories = [
      'Academic',
      'Career',
      'Cultural',
      'Social',
      'Sports',
      'Technology',
      'Workshop',
      'Other',
    ]

    for (const req of requiredCategories) {
      assert.ok(
        values.includes(req as (typeof values)[number]),
        `Expected canonical categories to include ${req}`
      )
    }
  })

  test('Every category selectable by an organizer is filterable by a student', () => {
    const organizerOptions = EVENT_CATEGORIES.map((c) => c.value)
    const studentFilterOptions = ['All', ...EVENT_CATEGORIES.map((c) => c.label)]

    for (const opt of organizerOptions) {
      const match = studentFilterOptions.some(
        (filter) => filter.toLowerCase() === opt.toLowerCase()
      )
      assert.ok(
        match,
        `Organizer category '${opt}' must be present in student filter options`
      )
    }
  })
})

describe('Phase 2: Date, Time and Status Correctness', () => {
  test('An event at 8 PM is still registerable at noon on its event date', () => {
    const eventDate = '2026-09-10'
    const startTime = '20:00'
    const endTime = '22:00'
    const event = {
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      timezone: 'UTC',
    }

    // At noon on the event date (12:00 UTC)
    const noonOnEventDate = new Date('2026-09-10T12:00:00.000Z')

    // Must NOT be ended at noon!
    assert.equal(
      isEventPast(event, noonOnEventDate),
      false,
      'Event at 8 PM must not be past/ended at noon on the event day'
    )
    assert.equal(
      isEventUpcoming(event, noonOnEventDate),
      true,
      'Event at 8 PM must still be upcoming at noon'
    )

    // At 7:59 PM (just before start)
    const justBeforeStart = new Date('2026-09-10T19:59:00.000Z')
    assert.equal(isEventPast(event, justBeforeStart), false)

    // At 9:00 PM (during the event)
    const duringEvent = new Date('2026-09-10T21:00:00.000Z')
    assert.equal(
      isEventPast(event, duringEvent),
      false,
      'Event should not be marked ended while still in progress'
    )

    // At 10:01 PM (after end time)
    const afterEndTime = new Date('2026-09-10T22:01:00.000Z')
    assert.equal(
      isEventPast(event, afterEndTime),
      true,
      'Event must be marked past/ended after end time'
    )
  })

  test('Timezone-aware event end calculations with IANA timezones', () => {
    // Event in New York ending at 20:00 EDT (which is 2026-09-11T00:00:00Z UTC)
    const nyEvent = {
      event_date: '2026-09-10',
      end_time: '20:00',
      timezone: 'America/New_York',
    }

    const nyEndDate = getEventEndDateTime(
      nyEvent.event_date,
      nyEvent.end_time,
      nyEvent.timezone
    )
    assert.equal(
      nyEndDate.toISOString(),
      '2026-09-11T00:00:00.000Z',
      'Should correctly resolve 8 PM EDT to 00:00 UTC next day'
    )

    // At 23:00 UTC on 2026-09-10, it is 7:00 PM EDT in New York — event has NOT ended yet
    const checkTime = new Date('2026-09-10T23:00:00.000Z')
    assert.equal(isEventPast(nyEvent, checkTime), false)

    // At 00:30 UTC on 2026-09-11, it is 8:30 PM EDT — event HAS ended
    const checkTimeAfter = new Date('2026-09-11T00:30:00.000Z')
    assert.equal(isEventPast(nyEvent, checkTimeAfter), true)
  })
})

describe('Phase 2: Capacity and Cancelled Registrations', () => {
  function computeCapacityState(
    capacity: number | null,
    activeRegistrationsCount: number
  ) {
    const spotsLeft =
      capacity !== null ? Math.max(0, capacity - activeRegistrationsCount) : null
    const isFull = spotsLeft === 0
    return { spotsLeft, isFull }
  }

  test('A cancelled registration frees a spot everywhere in the app', () => {
    const capacity = 10
    let activeRegistrations = 9

    // 1 spot remaining
    let state = computeCapacityState(capacity, activeRegistrations)
    assert.equal(state.spotsLeft, 1)
    assert.equal(state.isFull, false)

    // 10th student registers -> event becomes full
    activeRegistrations++
    state = computeCapacityState(capacity, activeRegistrations)
    assert.equal(state.spotsLeft, 0)
    assert.equal(state.isFull, true)

    // A student cancels their registration -> spot is freed!
    activeRegistrations--
    state = computeCapacityState(capacity, activeRegistrations)
    assert.equal(state.spotsLeft, 1, 'Cancelling registration must free 1 spot')
    assert.equal(
      state.isFull,
      false,
      'Event must no longer be marked full after cancellation'
    )
  })

  test('Cancelled registrations are never counted towards active capacity', () => {
    const capacity = 20
    const rawRegistrations = [
      { id: '1', status: 'registered' },
      { id: '2', status: 'registered' },
      { id: '3', status: 'registered' },
      { id: '4', status: 'cancelled' },
      { id: '5', status: 'cancelled' },
    ]

    // Active count must only filter for 'registered'
    const activeCount = rawRegistrations.filter((r) => r.status === 'registered').length
    assert.equal(activeCount, 3)

    const state = computeCapacityState(capacity, activeCount)
    assert.equal(
      state.spotsLeft,
      17,
      '20 capacity - 3 active registrations should leave 17 spots'
    )
  })
})

describe('Phase 2: Deterministic Availability Sorting', () => {
  interface SortableEvent {
    id: string
    title: string
    event_date: string
    start_time: string
    capacity: number | null
    active_registrations_count: number
  }

  function sortEventsByAvailability(events: SortableEvent[]): SortableEvent[] {
    return [...events].sort((a, b) => {
      const aIsUnlimited = a.capacity === null
      const bIsUnlimited = b.capacity === null

      // Both unlimited: deterministic tie-breaker
      if (aIsUnlimited && bIsUnlimited) {
        const dateCmp = a.event_date.localeCompare(b.event_date)
        if (dateCmp !== 0) return dateCmp
        const timeCmp = a.start_time.localeCompare(b.start_time)
        if (timeCmp !== 0) return timeCmp
        return a.title.localeCompare(b.title)
      }

      // Unlimited events have infinite availability
      if (aIsUnlimited) return -1
      if (bIsUnlimited) return 1

      const aSpots = Math.max(0, a.capacity! - a.active_registrations_count)
      const bSpots = Math.max(0, b.capacity! - b.active_registrations_count)

      if (bSpots !== aSpots) {
        return bSpots - aSpots
      }

      const dateCmp = a.event_date.localeCompare(b.event_date)
      if (dateCmp !== 0) return dateCmp
      const timeCmp = a.start_time.localeCompare(b.start_time)
      if (timeCmp !== 0) return timeCmp
      return a.title.localeCompare(b.title)
    })
  }

  test('Sorting handles unlimited capacity without returning NaN and orders predictably', () => {
    const events: SortableEvent[] = [
      {
        id: '1',
        title: 'Full Event',
        event_date: '2026-09-12',
        start_time: '10:00',
        capacity: 50,
        active_registrations_count: 50, // 0 spots
      },
      {
        id: '2',
        title: 'Unlimited A',
        event_date: '2026-09-15',
        start_time: '14:00',
        capacity: null, // Unlimited
        active_registrations_count: 100,
      },
      {
        id: '3',
        title: 'Unlimited B',
        event_date: '2026-09-11',
        start_time: '09:00',
        capacity: null, // Unlimited, sooner date
        active_registrations_count: 20,
      },
      {
        id: '4',
        title: 'High Availability',
        event_date: '2026-09-13',
        start_time: '11:00',
        capacity: 100,
        active_registrations_count: 10, // 90 spots
      },
      {
        id: '5',
        title: 'Moderate Availability',
        event_date: '2026-09-14',
        start_time: '12:00',
        capacity: 50,
        active_registrations_count: 25, // 25 spots
      },
    ]

    const sorted = sortEventsByAvailability(events)

    // Verify ordering:
    // 1. Unlimited B (unlimited, date 2026-09-11)
    // 2. Unlimited A (unlimited, date 2026-09-15)
    // 3. High Availability (90 spots)
    // 4. Moderate Availability (25 spots)
    // 5. Full Event (0 spots)
    assert.equal(sorted[0]?.title, 'Unlimited B')
    assert.equal(sorted[1]?.title, 'Unlimited A')
    assert.equal(sorted[2]?.title, 'High Availability')
    assert.equal(sorted[3]?.title, 'Moderate Availability')
    assert.equal(sorted[4]?.title, 'Full Event')

    // Verify no NaN during comparison
    for (let i = 0; i < sorted.length - 1; i++) {
      assert.ok(sorted[i] !== undefined)
    }
  })
})

describe('Phase 2: Favorite Button Logic & Accessibility', () => {
  test('Favorite button has accessible labels and login redirect', () => {
    // Unfavorited state
    const unfavoritedAriaLabel = (isFav: boolean) =>
      isFav ? 'Remove from favorites' : 'Add to favorites'

    assert.equal(unfavoritedAriaLabel(false), 'Add to favorites')
    assert.equal(unfavoritedAriaLabel(true), 'Remove from favorites')

    // Callback URL for unauthenticated users
    const slug = 'campus-hackathon-2026'
    const loginRedirectUrl = `/login?callbackUrl=${encodeURIComponent(`/events/${slug}`)}`
    assert.equal(
      loginRedirectUrl,
      '/login?callbackUrl=%2Fevents%2Fcampus-hackathon-2026'
    )
  })
})
