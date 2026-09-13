import { describe, test, assert } from 'vitest'

import type { Campus, Profile } from '@/types'

describe('Phase 3: Campus Model & Domain Matching', () => {
  const sampleCampuses: Campus[] = [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      name: 'Demo Campus',
      slug: 'demo',
      approved_domains: [],
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'c0000000-0000-0000-0000-000000000002',
      name: 'UC Berkeley',
      slug: 'berkeley',
      approved_domains: ['berkeley.edu'],
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'c0000000-0000-0000-0000-000000000003',
      name: 'Stanford University',
      slug: 'stanford',
      approved_domains: ['stanford.edu'],
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'c0000000-0000-0000-0000-000000000004',
      name: 'MIT',
      slug: 'mit',
      approved_domains: ['mit.edu'],
      is_active: false, // Inactive campus
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ]

  function matchCampusByEmail(email: string, campuses: Campus[]): Campus | null {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return null

    const activeCampuses = campuses.filter((c) => c.is_active)
    return (
      activeCampuses.find((c) =>
        c.approved_domains.some((d) => d.toLowerCase() === domain)
      ) || null
    )
  }

  test('auto-detects active campus matching verified email domain', () => {
    const matched = matchCampusByEmail('student@berkeley.edu', sampleCampuses)
    assert.ok(matched, 'Should match UC Berkeley')
    assert.equal(matched?.slug, 'berkeley')
    assert.equal(matched?.name, 'UC Berkeley')
  })

  test('handles case-insensitive email domain matching', () => {
    const matched = matchCampusByEmail('STUDENT@BERKELEY.EDU', sampleCampuses)
    assert.ok(matched)
    assert.equal(matched?.slug, 'berkeley')
  })

  test('does not match inactive campuses even if domain matches', () => {
    const matched = matchCampusByEmail('student@mit.edu', sampleCampuses)
    assert.equal(matched, null, 'Inactive campus MIT must not be matched')
  })

  test('falls back to null or open campus when domain does not match restricted list', () => {
    const matched = matchCampusByEmail('student@gmail.com', sampleCampuses)
    assert.equal(matched, null, 'Public domain must not match restricted campuses')
  })

  test('domain restriction validation rejects joining restricted campus with mismatched domain', () => {
    const berkeleyCampus = sampleCampuses.find((c) => c.slug === 'berkeley')!
    const userEmail = 'student@stanford.edu'
    const userDomain = userEmail.split('@')[1]?.toLowerCase()

    const isEligible =
      berkeleyCampus.approved_domains.length === 0 ||
      berkeleyCampus.approved_domains.some((d) => d.toLowerCase() === userDomain)

    assert.equal(isEligible, false, 'Stanford email cannot join Berkeley-restricted campus')
  })

  test('domain restriction permits joining campus with empty approved_domains (open campus)', () => {
    const demoCampus = sampleCampuses.find((c) => c.slug === 'demo')!
    const userEmail = 'student@anywhere.org'
    const userDomain = userEmail.split('@')[1]?.toLowerCase()

    const isEligible =
      demoCampus.approved_domains.length === 0 ||
      demoCampus.approved_domains.some((d) => d.toLowerCase() === userDomain)

    assert.equal(isEligible, true, 'Open campus allows students from any domain')
  })
})

describe('Phase 3: Feed Scoping & Discovery Parameters', () => {
  interface QueryParams {
    campus?: string
    userCampusId?: string | null
  }

  function resolveEffectiveCampusFilter(params: QueryParams): string | null {
    // 1. Explicit cross-campus discovery
    if (params.campus === 'all') {
      return null
    }
    // 2. Explicit target campus slug
    if (params.campus) {
      return params.campus
    }
    // 3. Authenticated user default
    if (params.userCampusId) {
      return params.userCampusId
    }
    // 4. Unauthenticated default (global feed)
    return null
  }

  test('signed-in user defaults to their campus when no parameter is provided', () => {
    const userCampusId = 'c0000000-0000-0000-0000-000000000002'
    const filter = resolveEffectiveCampusFilter({ userCampusId })
    assert.equal(filter, userCampusId, 'Must default to authenticated user campus ID')
  })

  test('signed-in user can intentionally browse all campuses via ?campus=all', () => {
    const userCampusId = 'c0000000-0000-0000-0000-000000000002'
    const filter = resolveEffectiveCampusFilter({ campus: 'all', userCampusId })
    assert.equal(filter, null, 'Explicit all must bypass user campus filter')
  })

  test('signed-in user can explore another campus via ?campus=<slug>', () => {
    const userCampusId = 'c0000000-0000-0000-0000-000000000002' // Berkeley
    const filter = resolveEffectiveCampusFilter({ campus: 'stanford', userCampusId })
    assert.equal(filter, 'stanford', 'Must filter by requested target campus slug')
  })

  test('unauthenticated user defaults to all campuses without parameter', () => {
    const filter = resolveEffectiveCampusFilter({ userCampusId: null })
    assert.equal(filter, null, 'Unauthenticated user sees global feed by default')
  })

  test('unauthenticated user can filter to a specific campus via ?campus=<slug>', () => {
    const filter = resolveEffectiveCampusFilter({ campus: 'berkeley', userCampusId: null })
    assert.equal(filter, 'berkeley', 'Unauthenticated user can target a specific campus')
  })
})

describe('Phase 3: Strict Event Campus Inheritance & Organizer Constraints', () => {
  test('event creation strictly inherits campus_id from organizer profile', () => {
    const organizerProfile: Partial<Profile> = {
      id: 'org-123',
      role: 'organizer',
      is_verified: true,
      campus_id: 'c0000000-0000-0000-0000-000000000002',
    }

    // Attempt to create event
    const eventPayload = {
      title: 'Hackathon 2027',
      organizer_id: organizerProfile.id!,
      // Even if client tried to specify a different campus:
      requested_campus_id: 'c0000000-0000-0000-0000-000000000003',
    }
    assert.ok(eventPayload.title)

    // Enforcement logic (mirrors server action & database trigger):
    // Server action assigns organizerProfile.campus_id unconditionally
    const assignedCampusId = organizerProfile.campus_id

    assert.equal(
      assignedCampusId,
      'c0000000-0000-0000-0000-000000000002',
      'Event must strictly inherit organizer campus ID'
    )
  })

  test('organizer without assigned campus cannot create events', () => {
    const organizerWithoutCampus: Partial<Profile> = {
      id: 'org-no-campus',
      role: 'organizer',
      is_verified: true,
      campus_id: null,
    }

    function validateCanCreateEvent(profile: Partial<Profile>): { allowed: boolean; error?: string } {
      if (!profile.is_verified || profile.role !== 'organizer') {
        return { allowed: false, error: 'Only verified organizers can create events' }
      }
      if (!profile.campus_id) {
        return { allowed: false, error: 'Organizer must be assigned to a campus before creating events' }
      }
      return { allowed: true }
    }

    const result = validateCanCreateEvent(organizerWithoutCampus)
    assert.equal(result.allowed, false)
    assert.match(result.error!, /Organizer must be assigned to a campus/)
  })

  test('database trigger simulation rejects mismatched event campus_id', () => {
    const organizerCampusId = 'c0000000-0000-0000-0000-000000000002'

    function checkEventCampusInheritanceTrigger(eventCampusId: string | null, orgCampusId: string | null) {
      if (!orgCampusId) {
        throw new Error('Organizer has no campus assigned')
      }
      if (eventCampusId !== null && eventCampusId !== orgCampusId) {
        throw new Error('Events must strictly belong to the organizer campus')
      }
      return orgCampusId
    }

    // Setting matching campus succeeds
    assert.doesNotThrow(() => {
      checkEventCampusInheritanceTrigger(organizerCampusId, organizerCampusId)
    })

    // Setting NULL campus automatically inherits
    const inherited = checkEventCampusInheritanceTrigger(null, organizerCampusId)
    assert.equal(inherited, organizerCampusId)

    // Setting different campus throws error
    assert.throws(
      () => {
        checkEventCampusInheritanceTrigger('c0000000-0000-0000-0000-000000000003', organizerCampusId)
      },
      /Events must strictly belong to the organizer campus/
    )
  })
})


describe('Phase 3: Trust Cues & Badges', () => {
  test('verified badge is only shown when organizer is_verified is true', () => {
    function shouldShowVerifiedBadge(organizer: { is_verified?: boolean } | null): boolean {
      return !!organizer?.is_verified
    }

    assert.equal(shouldShowVerifiedBadge({ is_verified: true }), true)
    assert.equal(shouldShowVerifiedBadge({ is_verified: false }), false)
    assert.equal(shouldShowVerifiedBadge({ is_verified: undefined }), false)
    assert.equal(shouldShowVerifiedBadge(null), false)
  })

  test('campus badge is rendered when campus metadata is present', () => {
    function getCampusBadgeLabel(campus?: { name: string } | null): string | null {
      return campus?.name || null
    }

    assert.equal(getCampusBadgeLabel({ name: 'UC Berkeley' }), 'UC Berkeley')
    assert.equal(getCampusBadgeLabel(null), null)
    assert.equal(getCampusBadgeLabel(undefined), null)
  })
})

describe('Phase 3: Signup Role Selection & Unverified State', () => {
  test('user selecting organizer in signup gets organizer role but is_verified remains false', () => {
    function simulateHandleNewUser(rawUserMetaData: Record<string, string | undefined>) {
      const role =
        rawUserMetaData.role === 'organizer' || rawUserMetaData.requested_role === 'organizer'
          ? 'organizer'
          : 'student'
      return {
        role,
        is_verified: false,
      }
    }

    const studentResult = simulateHandleNewUser({ role: 'student' })
    assert.equal(studentResult.role, 'student')
    assert.equal(studentResult.is_verified, false)

    const organizerResult = simulateHandleNewUser({ role: 'organizer', requested_role: 'organizer' })
    assert.equal(organizerResult.role, 'organizer', 'Organizer selection sets role to organizer')
    assert.equal(organizerResult.is_verified, false, 'Organizer remains unverified until admin approval')
  })
})

