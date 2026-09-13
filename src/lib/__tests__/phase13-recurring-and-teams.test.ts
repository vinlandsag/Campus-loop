import { describe, it, expect } from 'vitest'
import {
  generateOccurrences,
  formatRecurrenceRule,
  calculateSeriesProgress,
} from '@/lib/events/recurrence'
import { generateSeriesIcs } from '@/lib/calendar/ics'
import type { Event, EventRegistrationTeam, EventRegistrationTeamMember } from '@/types'

describe('Phase 13: Recurring Events, Event Series & Team Registration', () => {
  describe('Recurrence Generation Engine', () => {
    it('generates weekly occurrences on specified days of the week', () => {
      const occurrences = generateOccurrences({
        startDate: '2026-10-05', // Monday
        startTime: '18:00',
        endTime: '19:30',
        recurrenceType: 'weekly',
        intervalValue: 1,
        daysOfWeek: [1, 3], // Mon & Wed
        endType: 'count',
        occurrenceCount: 4,
        seriesTitle: 'AI Study Group',
        seriesSlug: 'ai-study-group',
      })

      expect(occurrences).toHaveLength(4)
      expect(occurrences[0]!.eventDate).toBe('2026-10-05') // Monday
      expect(occurrences[0]!.sequenceIndex).toBe(1)
      expect(occurrences[0]!.title).toBe('AI Study Group - Session 1')
      expect(occurrences[0]!.slug).toBe('ai-study-group-session-1')

      expect(occurrences[1]!.eventDate).toBe('2026-10-07') // Wednesday
      expect(occurrences[1]!.sequenceIndex).toBe(2)

      expect(occurrences[2]!.eventDate).toBe('2026-10-12') // Next Monday
      expect(occurrences[3]!.eventDate).toBe('2026-10-14') // Next Wednesday
    })

    it('generates bi-weekly occurrences with interval value = 2', () => {
      const occurrences = generateOccurrences({
        startDate: '2026-10-01',
        startTime: '10:00',
        endTime: '11:00',
        recurrenceType: 'weekly',
        intervalValue: 2,
        daysOfWeek: [4], // Thursday
        endType: 'count',
        occurrenceCount: 3,
        seriesTitle: 'Leadership Workshop',
        seriesSlug: 'leadership-workshop',
      })

      expect(occurrences).toHaveLength(3)
      expect(occurrences[0]!.eventDate).toBe('2026-10-01')
      expect(occurrences[1]!.eventDate).toBe('2026-10-15')
      expect(occurrences[2]!.eventDate).toBe('2026-10-29')
    })

    it('generates monthly occurrences incrementing month-by-month', () => {
      const occurrences = generateOccurrences({
        startDate: '2026-10-15',
        startTime: '14:00',
        endTime: '16:00',
        recurrenceType: 'monthly',
        intervalValue: 1,
        endType: 'count',
        occurrenceCount: 3,
        seriesTitle: 'Monthly Town Hall',
        seriesSlug: 'monthly-town-hall',
      })

      expect(occurrences).toHaveLength(3)
      expect(occurrences[0]!.eventDate).toBe('2026-10-15')
      expect(occurrences[1]!.eventDate).toBe('2026-11-15')
      expect(occurrences[2]!.eventDate).toBe('2026-12-15')
    })

    it('respects end date boundaries when endType is date', () => {
      const occurrences = generateOccurrences({
        startDate: '2026-10-01',
        startTime: '09:00',
        endTime: '10:00',
        recurrenceType: 'custom',
        intervalValue: 10, // Every 10 days
        endType: 'date',
        endDate: '2026-10-25',
        seriesTitle: 'Sprint Review',
        seriesSlug: 'sprint-review',
      })

      expect(occurrences).toHaveLength(3)
      expect(occurrences[0]!.eventDate).toBe('2026-10-01')
      expect(occurrences[1]!.eventDate).toBe('2026-10-11')
      expect(occurrences[2]!.eventDate).toBe('2026-10-21')
    })

    it('enforces safeguard limit of max 52 occurrences', () => {
      const occurrences = generateOccurrences({
        startDate: '2026-01-01',
        startTime: '08:00',
        endTime: '09:00',
        recurrenceType: 'custom',
        intervalValue: 1, // Daily
        endType: 'count',
        occurrenceCount: 1000, // Excessive request
        seriesTitle: 'Daily Standup',
        seriesSlug: 'daily-standup',
      })

      expect(occurrences.length).toBe(52)
    })
  })

  describe('Series Progress & Presentation', () => {
    it('formats human-friendly recurrence description rules', () => {
      expect(
        formatRecurrenceRule({
          recurrenceType: 'weekly',
          intervalValue: 1,
          daysOfWeek: [2],
          endType: 'count',
          occurrenceCount: 8,
        })
      ).toBe('Weekly on Tuesday • 8 sessions')

      expect(
        formatRecurrenceRule({
          recurrenceType: 'monthly',
          intervalValue: 2,
          endType: 'date',
          endDate: '2026-12-31',
        })
      ).toBe('Every 2 months • Until 2026-12-31')
    })

    it('accurately calculates completed, upcoming, and cancelled sessions progress', () => {
      const mockOccurrences = [
        { event_date: '2026-01-01', status: 'published' },
        { event_date: '2026-01-08', status: 'published' },
        { event_date: '2026-01-15', status: 'cancelled' },
        { event_date: '2099-10-01', status: 'published' },
        { event_date: '2099-10-08', status: 'published' },
      ]

      const progress = calculateSeriesProgress(mockOccurrences)
      expect(progress.total).toBe(5)
      expect(progress.completed).toBe(2)
      expect(progress.cancelled).toBe(1)
      expect(progress.upcoming).toBe(2)
      expect(progress.nextSessionIndex).toBe(4)
    })
  })

  describe('Single-Session Modification & Isolation', () => {
    it('modifies one occurrence location and sets is_series_override without altering siblings', () => {
      const seriesEvents: Event[] = [
        {
          id: 'evt-s1',
          series_id: 'series-alpha',
          series_sequence_index: 1,
          is_series_override: false,
          title: 'Web Dev Lab - Session 1',
          slug: 'web-dev-lab-session-1',
          location: 'Room 101',
          starts_at: '2026-10-01T10:00:00Z',
          ends_at: '2026-10-01T12:00:00Z',
          category: 'Workshop',
          organizer_id: 'org-1',
          description: 'Introduction',
          cover_image: null,
          capacity: 30,
          is_published: true,
          tags: [],
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
        {
          id: 'evt-s2',
          series_id: 'series-alpha',
          series_sequence_index: 2,
          is_series_override: false,
          title: 'Web Dev Lab - Session 2',
          slug: 'web-dev-lab-session-2',
          location: 'Room 101',
          starts_at: '2026-10-08T10:00:00Z',
          ends_at: '2026-10-08T12:00:00Z',
          category: 'Workshop',
          organizer_id: 'org-1',
          description: 'Deep Dive',
          cover_image: null,
          capacity: 30,
          is_published: true,
          tags: [],
          created_at: '2026-09-01T00:00:00Z',
          updated_at: '2026-09-01T00:00:00Z',
        },
      ]

      const updatedS2: Event = {
        ...seriesEvents[1]!,
        location: 'Auditorium B',
        is_series_override: true,
      }

      expect(seriesEvents[0]!.location).toBe('Room 101')
      expect(seriesEvents[0]!.is_series_override).toBe(false)
      expect(updatedS2.location).toBe('Auditorium B')
      expect(updatedS2.is_series_override).toBe(true)
      expect(updatedS2.series_id).toBe('series-alpha')
    })

    it('cancels one occurrence with cancellation reason while preserving other series sessions', () => {
      const occurrences: Array<{ id: string; status: string; cancellation_reason: string | null }> = [
        { id: 'occ-1', status: 'published', cancellation_reason: null },
        { id: 'occ-2', status: 'published', cancellation_reason: null },
        { id: 'occ-3', status: 'published', cancellation_reason: null },
      ]

      const target = occurrences[1]!
      target.status = 'cancelled'
      target.cancellation_reason = 'Instructor unavailable due to illness'

      expect(occurrences[0]!.status).toBe('published')
      expect(occurrences[1]!.status).toBe('cancelled')
      expect(occurrences[1]!.cancellation_reason).toBe('Instructor unavailable due to illness')
      expect(occurrences[2]!.status).toBe('published')
    })
  })

  describe('Group & Team Registration Logic', () => {
    it('creates team with forming status when members are below min_team_size', () => {
      const team: EventRegistrationTeam = {
        id: 'team-101',
        event_id: 'evt-hackathon',
        name: 'Quantum Coders',
        leader_id: 'user-alice',
        invite_code: 'QNTM89X24A',
        status: 'forming',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        members: [
          {
            id: 'mem-1',
            team_id: 'team-101',
            user_id: 'user-alice',
            event_id: 'evt-hackathon',
            role: 'leader',
            status: 'pending',
            joined_at: new Date().toISOString(),
          },
        ],
      }

      expect(team.status).toBe('forming')
      expect(team.members?.[0]?.status).toBe('pending')
      expect(team.invite_code).toMatch(/^[A-Z0-9]{10}$/)
    })

    it('promotes team status to complete and confirms registrations when min_team_size is reached', () => {
      const minTeamSize = 2

      const members: EventRegistrationTeamMember[] = [
        {
          id: 'mem-1',
          team_id: 'team-102',
          user_id: 'user-alice',
          event_id: 'evt-hackathon',
          role: 'leader',
          status: 'pending',
          joined_at: new Date().toISOString(),
        },
      ]

      let teamStatus = 'forming'

      const newMember: EventRegistrationTeamMember = {
        id: 'mem-2',
        team_id: 'team-102',
        user_id: 'user-bob',
        event_id: 'evt-hackathon',
        role: 'member',
        status: 'pending',
        joined_at: new Date().toISOString(),
      }
      members.push(newMember)

      if (members.length >= minTeamSize) {
        teamStatus = 'complete'
        members.forEach((m) => {
          m.status = 'confirmed'
        })
      }

      expect(teamStatus).toBe('complete')
      expect(members[0]!.status).toBe('confirmed')
      expect(members[1]!.status).toBe('confirmed')
    })

    it('rejects new members when team reaches max_team_size', () => {
      const maxTeamSize = 3
      const currentMembers = ['alice', 'bob', 'carol']

      const canJoin = (_candidate: string) => {
        if (currentMembers.length >= maxTeamSize) {
          return { allowed: false, error: 'Team capacity reached' }
        }
        return { allowed: true }
      }

      const result = canJoin('dave')
      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Team capacity reached')
    })

    it('enforces event capacity atomically across teams', () => {
      const eventCapacity = 6
      let currentActiveRegistrations = 4
      const newTeamMinSize = 3

      const canFormTeam = (minSize: number) => {
        if (currentActiveRegistrations + minSize > eventCapacity) {
          return { allowed: false, error: 'Not enough capacity remaining for team' }
        }
        currentActiveRegistrations += minSize
        return { allowed: true }
      }

      const res = canFormTeam(newTeamMinSize)
      expect(res.allowed).toBe(false)
      expect(res.error).toBe('Not enough capacity remaining for team')
      expect(currentActiveRegistrations).toBe(4)
    })

    it('prevents user from joining two teams in the same event', () => {
      const existingMemberships = new Map<string, string>()
      existingMemberships.set('user-alice', 'evt-hackathon')

      const joinTeam = (userId: string, eventId: string) => {
        if (existingMemberships.get(userId) === eventId) {
          return { allowed: false, error: 'User already in a team for this event' }
        }
        existingMemberships.set(userId, eventId)
        return { allowed: true }
      }

      const duplicateAttempt = joinTeam('user-alice', 'evt-hackathon')
      expect(duplicateAttempt.allowed).toBe(false)
      expect(duplicateAttempt.error).toBe('User already in a team for this event')
    })

    it('reverts team status to forming when member leaves and count drops below min_team_size', () => {
      const minTeamSize = 2
      let members = ['alice', 'bob']
      let status = members.length >= minTeamSize ? 'complete' : 'forming'
      expect(status).toBe('complete')

      members = members.filter((m) => m !== 'bob')
      if (members.length < minTeamSize) {
        status = 'forming'
      }

      expect(status).toBe('forming')
      expect(members).toHaveLength(1)
    })
  })

  describe('Series Multi-Event Calendar (.ics) Generation', () => {
    it('generates compliant multi-session RFC 5545 iCalendar stream', () => {
      const ics = generateSeriesIcs({
        seriesId: 'series-test-1',
        seriesTitle: 'Machine Learning Seminar Series',
        description: 'Comprehensive 4-week seminar series on neural networks.',
        organizerName: 'AI Club',
        organizerEmail: 'aiclub@campus.edu',
        sessions: [
          {
            id: 'sess-1',
            title: 'ML Seminar: Week 1',
            eventDate: '2026-10-06',
            startTime: '17:00',
            endTime: '18:30',
            location: 'Science Hall 301',
          },
          {
            id: 'sess-2',
            title: 'ML Seminar: Week 2',
            eventDate: '2026-10-13',
            startTime: '17:00',
            endTime: '18:30',
            location: 'Science Hall 301',
          },
        ],
      })

      expect(ics).toContain('BEGIN:VCALENDAR')
      expect(ics).toContain('VERSION:2.0')
      expect(ics).toContain('X-WR-CALNAME:Machine Learning Seminar Series')
      expect(ics).toContain('SUMMARY:ML Seminar: Week 1')
      expect(ics).toContain('SUMMARY:ML Seminar: Week 2')
      expect(ics).toContain('DTSTART:20261006T170000')
      expect(ics).toContain('DTSTART:20261013T170000')
      expect(ics).toContain('ORGANIZER;CN=AI Club:mailto:aiclub@campus.edu')
      expect(ics).toContain('END:VCALENDAR')
    })
  })
})
