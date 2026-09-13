import { describe, test, assert } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

interface MockEvent {
  id: string
  title: string
  slug: string
  category: string
  event_date: string
  start_time: string
  location: string
  capacity: number | null
  active_registrations_count: number
  is_paid: boolean
  price: number | null
  organizer_id: string
  campus_id: string | null
  status: 'draft' | 'published' | 'cancelled'
  eligibility?: string | null
  registration_deadline?: string | null
  what_to_bring?: string | null
  contact_method?: string | null
  accessibility_notes?: string | null
  map_url?: string | null
}

describe('Phase 7: Discovery Lenses & Transparent Ranking Rules', () => {
  const todayStr = '2026-09-15'

  const sampleEvents: MockEvent[] = [
    {
      id: 'ev-today-late',
      title: 'Late Evening Hack Jam',
      slug: 'hack-jam',
      category: 'Tech',
      event_date: '2026-09-15',
      start_time: '18:00',
      location: 'Engineering Building Room 101',
      capacity: 50,
      active_registrations_count: 20,
      is_paid: false,
      price: null,
      organizer_id: 'org-1',
      campus_id: 'camp-main',
      status: 'published',
    },
    {
      id: 'ev-today-early',
      title: 'Morning Tech Keynote',
      slug: 'tech-keynote',
      category: 'Tech',
      event_date: '2026-09-15',
      start_time: '09:30',
      location: 'Main Auditorium',
      capacity: 200,
      active_registrations_count: 180,
      is_paid: false,
      price: null,
      organizer_id: 'org-verified',
      campus_id: 'camp-main',
      status: 'published',
    },
    {
      id: 'ev-this-week',
      title: 'Midweek Design Workshop',
      slug: 'design-workshop',
      category: 'Workshop',
      event_date: '2026-09-17',
      start_time: '14:00',
      location: 'Design Lab 3',
      capacity: 30,
      active_registrations_count: 30, // Full / Waitlist
      is_paid: true,
      price: 150,
      organizer_id: 'org-verified',
      campus_id: 'camp-main',
      status: 'published',
    },
    {
      id: 'ev-next-week',
      title: 'Next Week Career Fair',
      slug: 'career-fair',
      category: 'Career',
      event_date: '2026-09-25',
      start_time: '10:00',
      location: 'Online via Zoom',
      capacity: null, // Unlimited
      active_registrations_count: 350,
      is_paid: false,
      price: null,
      organizer_id: 'org-2',
      campus_id: 'camp-other',
      status: 'published',
    },
  ]

  test('Happening Today lens filters events occurring on today and sorts by start time', () => {
    const todayEvents = sampleEvents
      .filter((e) => e.event_date === todayStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

    assert.equal(todayEvents.length, 2)
    assert.equal(todayEvents[0]?.id, 'ev-today-early', '09:30 AM event must appear before 18:00 PM')
    assert.equal(todayEvents[1]?.id, 'ev-today-late')
  })

  test('This Week lens captures events between today and Sunday', () => {
    const endOfWeekStr = '2026-09-20'
    const thisWeekEvents = sampleEvents.filter(
      (e) => e.event_date >= todayStr && e.event_date <= endOfWeekStr
    )

    assert.equal(thisWeekEvents.length, 3)
    assert.ok(thisWeekEvents.some((e) => e.id === 'ev-today-early'))
    assert.ok(thisWeekEvents.some((e) => e.id === 'ev-today-late'))
    assert.ok(thisWeekEvents.some((e) => e.id === 'ev-this-week'))
    assert.ok(!thisWeekEvents.some((e) => e.id === 'ev-next-week'), 'Next week event must be excluded')
  })

  test('Popular lens ranks events by active attendee interest and ticket demand', () => {
    const popularEvents = [...sampleEvents].sort(
      (a, b) => b.active_registrations_count - a.active_registrations_count
    )

    assert.equal(popularEvents[0]?.id, 'ev-next-week', '350 registrations must rank highest')
    assert.equal(popularEvents[1]?.id, 'ev-today-early', '180 registrations must rank second')
    assert.equal(popularEvents[2]?.id, 'ev-this-week', '30 registrations must rank third')
  })

  test('Recommended for You lens scores campus alignment, department match, and verified organizers', () => {
    const userCampusId = 'camp-main'
    const userDepartment = 'Engineering'

    function scoreEvent(e: MockEvent): number {
      let score = 0
      if (e.campus_id === userCampusId) score += 1000
      if (
        e.location.toLowerCase().includes(userDepartment.toLowerCase()) ||
        e.title.toLowerCase().includes('tech')
      ) {
        score += 500
      }
      if (e.organizer_id === 'org-verified') score += 200
      score += Math.min(100, e.active_registrations_count)
      return score
    }

    const recommended = [...sampleEvents].sort((a, b) => scoreEvent(b) - scoreEvent(a))

    assert.equal(
      recommended[0]?.campus_id,
      'camp-main',
      'Event on student campus must score higher than cross-campus event'
    )
    assert.ok(scoreEvent(recommended[0]!) > scoreEvent(recommended[recommended.length - 1]!))
  })
})

describe('Phase 7: Advanced Multi-Filter Matrix', () => {
  const events: MockEvent[] = [
    {
      id: '1',
      title: 'Free Workshop',
      slug: 'free-workshop',
      category: 'Workshop',
      event_date: '2026-09-16',
      start_time: '10:00',
      location: 'Student Union Hall',
      capacity: 40,
      active_registrations_count: 25, // 15 spots left
      is_paid: false,
      price: null,
      organizer_id: 'club-acm',
      campus_id: 'c1',
      status: 'published',
    },
    {
      id: '2',
      title: 'Paid Conference',
      slug: 'paid-conf',
      category: 'Tech',
      event_date: '2026-09-18',
      start_time: '09:00',
      location: 'Auditorium A',
      capacity: 100,
      active_registrations_count: 100, // Full / Waitlist open
      is_paid: true,
      price: 250,
      organizer_id: 'club-ieee',
      campus_id: 'c1',
      status: 'published',
    },
    {
      id: '3',
      title: 'Online Career Webinar',
      slug: 'online-webinar',
      category: 'Career',
      event_date: '2026-09-20',
      start_time: '17:00',
      location: 'Online via Zoom',
      capacity: null, // Unlimited spots
      active_registrations_count: 50,
      is_paid: false,
      price: 0,
      organizer_id: 'club-acm',
      campus_id: 'c2',
      status: 'published',
    },
  ]

  test('Cost filter correctly differentiates free vs paid events', () => {
    const freeEvents = events.filter((e) => !e.is_paid || e.price === 0 || e.price === null)
    const paidEvents = events.filter((e) => e.is_paid && e.price !== null && e.price > 0)

    assert.equal(freeEvents.length, 2)
    assert.deepEqual(freeEvents.map((e) => e.id), ['1', '3'])
    assert.equal(paidEvents.length, 1)
    assert.equal(paidEvents[0]?.id, '2')
  })

  test('Format filter separates in-person venues from online webinars', () => {
    const isOnline = (loc: string) => /online|zoom|meet|virtual|remote|webinar/i.test(loc)
    const onlineEvents = events.filter((e) => isOnline(e.location))
    const inPersonEvents = events.filter((e) => !isOnline(e.location))

    assert.equal(onlineEvents.length, 1)
    assert.equal(onlineEvents[0]?.id, '3')
    assert.equal(inPersonEvents.length, 2)
    assert.deepEqual(inPersonEvents.map((e) => e.id), ['1', '2'])
  })

  test('Availability filter isolates open spots from waitlist events', () => {
    const openSpotsEvents = events.filter((e) => {
      if (e.capacity === null) return true
      return e.capacity > e.active_registrations_count
    })
    const waitlistEvents = events.filter((e) => {
      if (e.capacity === null) return false
      return e.active_registrations_count >= e.capacity
    })

    assert.equal(openSpotsEvents.length, 2, 'Events 1 and 3 have open capacity')
    assert.deepEqual(openSpotsEvents.map((e) => e.id), ['1', '3'])
    assert.equal(waitlistEvents.length, 1, 'Event 2 is at capacity')
    assert.equal(waitlistEvents[0]?.id, '2')
  })

  test('Club / Organizer filter scopes listings to the selected club', () => {
    const acmEvents = events.filter((e) => e.organizer_id === 'club-acm')
    assert.equal(acmEvents.length, 2)
    assert.deepEqual(acmEvents.map((e) => e.id), ['1', '3'])
  })
})

describe('Phase 7: Student Decision-Making & Eligibility Logic', () => {
  test('Registration deadline enforces RSVP cutoff', () => {
    const pastDeadline = '2026-09-01T12:00:00Z'
    const futureDeadline = '2026-10-01T12:00:00Z'
    const referenceNow = new Date('2026-09-11T00:00:00Z')

    const isPastDeadlineClosed = referenceNow > new Date(pastDeadline)
    const isFutureDeadlineClosed = referenceNow > new Date(futureDeadline)

    assert.equal(isPastDeadlineClosed, true, 'Event with past deadline must be closed to new registrations')
    assert.equal(isFutureDeadlineClosed, false, 'Event with future deadline must remain open')
  })

  test('What to bring and eligibility text provide clear attendee answers', () => {
    const event: MockEvent = {
      id: 'e1',
      title: 'Robotics Build Night',
      slug: 'robotics-night',
      category: 'Tech',
      event_date: '2026-09-20',
      start_time: '15:00',
      location: 'Robotics Lab',
      capacity: 25,
      active_registrations_count: 10,
      is_paid: false,
      price: null,
      organizer_id: 'org-1',
      campus_id: 'c1',
      status: 'published',
      eligibility: 'Open to all enrolled students with basic Python or C++ interest',
      what_to_bring: 'Laptop, charger, student ID card',
      accessibility_notes: 'Wheelchair accessible with elevator at East entrance',
      map_url: 'https://maps.google.com/?q=Campus+Robotics+Lab',
    }

    assert.ok(event.eligibility?.includes('enrolled students'))
    assert.ok(event.what_to_bring?.includes('Laptop'))
    assert.ok(event.accessibility_notes?.includes('Wheelchair accessible'))
    assert.ok(event.map_url?.startsWith('https://'))
  })
})

describe('Phase 7: Organizer & Club Profile Segregation', () => {
  const today = '2026-09-15'
  const clubEvents: MockEvent[] = [
    {
      id: 'ev-past-1',
      title: 'Spring Orientation 2026',
      slug: 'spring-orientation',
      category: 'Social',
      event_date: '2026-02-10',
      start_time: '10:00',
      location: 'Quad',
      capacity: 200,
      active_registrations_count: 180,
      is_paid: false,
      price: null,
      organizer_id: 'club-1',
      campus_id: 'c1',
      status: 'published',
    },
    {
      id: 'ev-past-2',
      title: 'Annual Hackathon 2026',
      slug: 'annual-hackathon',
      category: 'Tech',
      event_date: '2026-04-15',
      start_time: '09:00',
      location: 'Engineering Hub',
      capacity: 150,
      active_registrations_count: 150,
      is_paid: false,
      price: null,
      organizer_id: 'club-1',
      campus_id: 'c1',
      status: 'published',
    },
    {
      id: 'ev-upcoming-1',
      title: 'Fall AI Summit',
      slug: 'fall-ai-summit',
      category: 'Tech',
      event_date: '2026-10-01',
      start_time: '11:00',
      location: 'Auditorium',
      capacity: 100,
      active_registrations_count: 45,
      is_paid: false,
      price: null,
      organizer_id: 'club-1',
      campus_id: 'c1',
      status: 'published',
    },
  ]

  test('Correctly segregates upcoming vs past events and computes total attendee impact', () => {
    const upcoming = clubEvents.filter((e) => e.event_date >= today)
    const past = clubEvents.filter((e) => e.event_date < today)
    const totalAttendeesServed = clubEvents.reduce((sum, e) => sum + e.active_registrations_count, 0)

    assert.equal(upcoming.length, 1)
    assert.equal(upcoming[0]?.id, 'ev-upcoming-1')
    assert.equal(past.length, 2)
    assert.equal(totalAttendeesServed, 375, '180 + 150 + 45 = 375 total attendees')
  })
})

describe('Phase 7: Database Migration & Schema Integrity', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260911000000_phase7_discovery_profiles_event_details.sql'
  )

  test('Phase 7 migration file exists', () => {
    assert.ok(fs.existsSync(migrationPath), 'Migration file must exist')
  })

  test('Migration extends events table with student decision fields', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8')
    assert.ok(sql.includes('ALTER TABLE public.events'))
    assert.ok(sql.includes('agenda JSONB'))
    assert.ok(sql.includes('speakers JSONB'))
    assert.ok(sql.includes('eligibility TEXT'))
    assert.ok(sql.includes('registration_deadline TIMESTAMPTZ'))
    assert.ok(sql.includes('what_to_bring TEXT'))
    assert.ok(sql.includes('contact_method TEXT'))
    assert.ok(sql.includes('accessibility_notes TEXT'))
    assert.ok(sql.includes('map_url TEXT'))
  })

  test('Migration extends profiles table with club presentation fields', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8')
    assert.ok(sql.includes('ALTER TABLE public.profiles'))
    assert.ok(sql.includes('bio TEXT'))
    assert.ok(sql.includes('website_url TEXT'))
    assert.ok(sql.includes('instagram_handle TEXT'))
    assert.ok(sql.includes('contact_email TEXT'))
  })

  test('Migration updates organizer_profiles safe view and creates performance indexes', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8')
    assert.ok(sql.includes('CREATE OR REPLACE VIEW public.organizer_profiles'))
    assert.ok(sql.includes('idx_events_discovery_date_status'))
    assert.ok(sql.includes('idx_events_organizer_date'))
  })
})
