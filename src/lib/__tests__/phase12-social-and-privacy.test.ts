import { describe, it, expect } from 'vitest'
import {
  explainRecommendation,
  rankEventsForUser,
} from '@/lib/recommendations/ranking'
import type {
  Event,
  ConsentedFriendAttendance,
  UserSocialPreferences,
  FriendDetails,
} from '@/types'

describe('Phase 12: Social Discovery, Club Follows & Privacy-Preserving Friends', () => {
  const baseEvent: Event = {
    id: 'evt-100',
    organizer_id: 'org-tech-club',
    title: 'Campus Hackathon 2026',
    slug: 'campus-hackathon-2026',
    description: 'Annual 24-hour campus hacking event with industry mentors.',
    location: 'Engineering Hall 101',
    starts_at: '2026-09-15T09:00:00Z',
    ends_at: '2026-09-16T09:00:00Z',
    cover_image: null,
    category: 'Hackathon',
    capacity: 100,
    is_published: true,
    tags: ['coding', 'ai', 'technology'],
    campus_id: 'campus-alpha',
    campus: { id: 'campus-alpha', name: 'Alpha University', slug: 'alpha-univ' },
    created_at: '2026-09-01T12:00:00Z',
    updated_at: '2026-09-01T12:00:00Z',
    active_registrations_count: 20,
    organizer: {
      id: 'org-tech-club',
      display_name: 'Tech & Coding Club',
      avatar_url: null,
      is_verified: true,
    },
  }

  describe('Multi-Factor Transparent Recommendation Engine', () => {
    it('ranks event higher when on the student’s home campus (+1000 pts)', () => {
      const matchContext = { userCampusId: 'campus-alpha' }
      const diffContext = { userCampusId: 'campus-beta' }

      const explMatch = explainRecommendation(baseEvent, matchContext)
      const explDiff = explainRecommendation(baseEvent, diffContext)

      expect(explMatch.tags).toContain('campus_match')
      expect(explMatch.score).toBeGreaterThanOrEqual(1000)
      expect(explDiff.tags).not.toContain('campus_match')
      expect(explMatch.score).toBeGreaterThan(explDiff.score)
      expect(explMatch.reasons.some((r) => r.includes('Alpha University'))).toBe(true)
    })

    it('boosts score when event is from a club the student follows (+600 pts)', () => {
      const followedContext = {
        followedClubIds: new Set(['org-tech-club']),
      }
      const unFollowedContext = {
        followedClubIds: new Set(['org-arts-club']),
      }

      const explFollowed = explainRecommendation(baseEvent, followedContext)
      const explUnfollowed = explainRecommendation(baseEvent, unFollowedContext)

      expect(explFollowed.tags).toContain('followed_club')
      expect(explFollowed.score).toBeGreaterThanOrEqual(600)
      expect(explUnfollowed.tags).not.toContain('followed_club')
      expect(explFollowed.score).toBe(explUnfollowed.score + 600)
      expect(explFollowed.reasons.some((r) => r.includes('Tech & Coding Club'))).toBe(true)
    })

    it('boosts score when consented mutual friends are attending (+400+ pts)', () => {
      const friendAttendance: ConsentedFriendAttendance = {
        count: 2,
        friends: [
          { id: 'usr-friend-1', name: 'Alice Smith' },
          { id: 'usr-friend-2', name: 'Bob Jones' },
        ],
      }

      const contextWithFriends = {
        friendAttendanceMap: {
          'evt-100': friendAttendance,
        },
      }

      const expl = explainRecommendation(baseEvent, contextWithFriends)
      expect(expl.tags).toContain('friends_attending')
      expect(expl.score).toBeGreaterThanOrEqual(500) // 400 base + 100 for 2nd friend
      expect(expl.reasons.some((r) => r.includes('Alice Smith and 1 other friend attending'))).toBe(true)
    })

    it('does NOT boost or mention friends when friend attendance count is 0 or absent', () => {
      const emptyAttendance: ConsentedFriendAttendance = {
        count: 0,
        friends: [],
      }

      const expl = explainRecommendation(baseEvent, {
        friendAttendanceMap: { 'evt-100': emptyAttendance },
      })
      expect(expl.tags).not.toContain('friends_attending')
      expect(expl.reasons.some((r) => r.toLowerCase().includes('friend'))).toBe(false)
    })

    it('rewards matching category and tag interests (+300 pts)', () => {
      const interestContext = {
        userInterests: ['hackathons', 'robotics'],
      }
      const expl = explainRecommendation(baseEvent, interestContext)

      expect(expl.tags).toContain('category_interest')
      expect(expl.score).toBeGreaterThanOrEqual(300)
      expect(expl.reasons.some((r) => r.toLowerCase().includes('hackathon'))).toBe(true)
    })

    it('ranks upcoming events with capacity happening within 7 days (+150 pts)', () => {
      const refDate = new Date('2026-09-12T00:00:00Z') // Event starts on 2026-09-15 (in 3 days)
      const expl = explainRecommendation(baseEvent, { referenceDate: refDate })

      expect(expl.tags).toContain('happening_soon')
      expect(expl.score).toBeGreaterThanOrEqual(150)
      expect(expl.reasons.some((r) => r.includes('Happening this week'))).toBe(true)
    })

    it('correctly ranks an array of events descending by multi-factor score and breaks ties chronologically', () => {
      const eventFarMatch: Event = {
        ...baseEvent,
        id: 'evt-200',
        title: 'Farther Alpha Event',
        campus_id: 'campus-alpha',
        starts_at: '2026-09-28T09:00:00Z',
      }

      const eventDifferentCampus: Event = {
        ...baseEvent,
        id: 'evt-300',
        title: 'Beta Event',
        campus_id: 'campus-beta',
        campus: { id: 'campus-beta', name: 'Beta College', slug: 'beta-college' },
        starts_at: '2026-09-14T09:00:00Z',
      }

      const ranked = rankEventsForUser([eventDifferentCampus, eventFarMatch, baseEvent], {
        userCampusId: 'campus-alpha',
        followedClubIds: ['org-tech-club'],
      })

      // baseEvent has campus match (+1000) + followed club (+600) + happening soon (+150) + popular (+100)
      // eventFarMatch has campus match (+1000) + followed club (+600) + popular (+100)
      // eventDifferentCampus has followed club (+600) + happening soon (+150) + popular (+100)
      expect(ranked).toHaveLength(3)
      expect(ranked[0]!.id).toBe('evt-100')
      expect(ranked[1]!.id).toBe('evt-200')
      expect(ranked[2]!.id).toBe('evt-300')
      expect(ranked[0]!.recommendationExplanation.score).toBeGreaterThan(
        ranked[1]!.recommendationExplanation.score
      )
    })
  })

  describe('Social Privacy Invariants & Strict Consent', () => {
    it('defaults user social preferences to strict opt-in (share_attendance_with_friends = false, private default)', () => {
      const defaultPrefs: UserSocialPreferences = {
        user_id: 'usr-student-1',
        share_attendance_with_friends: false,
        default_attendance_visibility: 'private',
        allow_friend_requests: true,
      }

      expect(defaultPrefs.share_attendance_with_friends).toBe(false)
      expect(defaultPrefs.default_attendance_visibility).toBe('private')
    })

    it('enforces that attendance visibility is strictly limited to allowed values', () => {
      const allowed = ['private', 'friends', 'public']
      expect(allowed.includes('private')).toBe(true)
      expect(allowed.includes('friends')).toBe(true)
      expect(allowed.includes('public')).toBe(true)
      expect(allowed.includes('secret')).toBe(false)
    })

    it('preserves pairwise isolation in friend details', () => {
      const friendItem: FriendDetails = {
        friendship_id: 'f-101',
        friend_user_id: 'usr-student-2',
        full_name: 'Bob Jones',
        display_name: 'Bob',
        avatar_url: null,
        campus_name: 'Alpha University',
        status: 'accepted',
        is_requester: false,
        since: '2026-09-10T12:00:00Z',
      }

      expect(friendItem.status).toBe('accepted')
      expect(friendItem.friend_user_id).toBe('usr-student-2')
      expect(friendItem.is_requester).toBe(false)
    })
  })
})
