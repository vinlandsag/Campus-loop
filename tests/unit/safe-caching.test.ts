import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CACHE_TAGS } from '@/lib/cache/tags'
import {
  invalidateCampusCache,
  invalidateOrganizerCache,
  invalidateVenueCache,
  invalidateCategoriesCache,
} from '@/lib/cache/invalidation'
import * as nextCache from 'next/cache'

// Mock next/cache
vi.mock('next/cache', () => {
  return {
    unstable_cache: vi.fn((fn) => fn),
    revalidateTag: vi.fn(),
    updateTag: vi.fn(),
    revalidatePath: vi.fn(),
  }
})

// Mock createPublicClient
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockMaybeSingle = vi.fn()

const mockSupabase = {
  from: vi.fn(() => ({
    select: mockSelect,
  })),
}

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: vi.fn(() => mockSupabase),
}))

// Import public cache module after mocking
import {
  getCachedActiveCampuses,
  getCachedPublicOrganizer,
  getCachedPublicVenues,
  getCachedEventCategories,
} from '@/lib/cache/public-cache'
import { EVENT_CATEGORIES } from '@/lib/constants'

describe('Safe Public Caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder, maybeSingle: mockMaybeSingle })
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder, maybeSingle: mockMaybeSingle })
    mockOrder.mockResolvedValue({ data: [], error: null })
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
  })

  describe('CACHE_TAGS definitions', () => {
    it('defines standardized and safe cache tags for public resources', () => {
      expect(CACHE_TAGS.campuses).toBe('campuses')
      expect(CACHE_TAGS.activeCampuses).toBe('active-campuses')
      expect(CACHE_TAGS.organizers).toBe('organizers-public')
      expect(CACHE_TAGS.organizer('org_123')).toBe('organizer-org_123')
      expect(CACHE_TAGS.venues).toBe('venues')
      expect(CACHE_TAGS.campusVenues('camp_456')).toBe('venues-camp_456')
      expect(CACHE_TAGS.categories).toBe('event-categories')
    })
  })

  describe('Cache Invalidation Utilities', () => {
    it('invalidates campuses with Next.js 16 profile "max"', () => {
      invalidateCampusCache()
      expect(nextCache.revalidateTag).toHaveBeenCalledWith('campuses', 'max')
      expect(nextCache.revalidateTag).toHaveBeenCalledWith('active-campuses', 'max')
    })

    it('invalidates all organizers and a specific organizer when id is provided', () => {
      invalidateOrganizerCache('org_abc')
      expect(nextCache.revalidateTag).toHaveBeenCalledWith('organizers-public', 'max')
      expect(nextCache.revalidateTag).toHaveBeenCalledWith('organizer-org_abc', 'max')
    })

    it('invalidates only broad organizer tag if no id is provided', () => {
      invalidateOrganizerCache()
      expect(nextCache.revalidateTag).toHaveBeenCalledWith('organizers-public', 'max')
      expect(nextCache.revalidateTag).toHaveBeenCalledTimes(1)
    })

    it('invalidates venues and specific campus venues when campusId is provided', () => {
      invalidateVenueCache('camp_xyz')
      expect(nextCache.revalidateTag).toHaveBeenCalledWith('venues', 'max')
      expect(nextCache.revalidateTag).toHaveBeenCalledWith('venues-camp_xyz', 'max')
    })

    it('invalidates only broad venue tag when no campusId is provided', () => {
      invalidateVenueCache()
      expect(nextCache.revalidateTag).toHaveBeenCalledWith('venues', 'max')
      expect(nextCache.revalidateTag).toHaveBeenCalledTimes(1)
    })

    it('invalidates event categories', () => {
      invalidateCategoriesCache()
      expect(nextCache.revalidateTag).toHaveBeenCalledWith('event-categories', 'max')
    })

    it('gracefully handles invalidation errors without throwing', () => {
      vi.mocked(nextCache.revalidateTag).mockImplementationOnce(() => {
        throw new Error('Revalidation context missing')
      })
      expect(() => invalidateCampusCache()).not.toThrow()
    })
  })

  describe('Public Cache Retrievals', () => {
    it('fetches only active campuses ordered by name', async () => {
      const sampleCampuses = [
        { id: 'c1', name: 'Alpha Campus', is_active: true },
        { id: 'c2', name: 'Beta Campus', is_active: true },
      ]
      mockOrder.mockResolvedValueOnce({ data: sampleCampuses, error: null })

      const result = await getCachedActiveCampuses()
      expect(mockSupabase.from).toHaveBeenCalledWith('campuses')
      expect(mockSelect).toHaveBeenCalledWith('*')
      expect(mockEq).toHaveBeenCalledWith('is_active', true)
      expect(mockOrder).toHaveBeenCalledWith('name', { ascending: true })
      expect(result).toEqual(sampleCampuses)
    })

    it('returns empty array if campus query fails', async () => {
      mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'Database error' } })
      const result = await getCachedActiveCampuses()
      expect(result).toEqual([])
    })

    it('returns public summary for verified organizer', async () => {
      const verifiedProfile = {
        id: 'org_1',
        full_name: 'Tech Club',
        avatar_url: 'https://example.com/avatar.png',
        bio: 'Official coding society',
        website_url: 'https://techclub.org',
        instagram_handle: 'techclub',
        contact_email: 'contact@techclub.org',
        campus_id: 'c1',
        college: 'Engineering',
        department: 'CS',
        is_verified: true,
      }
      mockMaybeSingle.mockResolvedValueOnce({ data: verifiedProfile, error: null })

      const result = await getCachedPublicOrganizer('org_1')
      expect(mockSupabase.from).toHaveBeenCalledWith('organizer_profiles')
      expect(mockEq).toHaveBeenCalledWith('id', 'org_1')
      expect(result).toEqual(verifiedProfile)
    })

    it('returns null for unverified organizer, preventing leakage of unverified data', async () => {
      const unverifiedProfile = {
        id: 'org_unverified',
        full_name: 'Suspicious Club',
        is_verified: false,
      }
      mockMaybeSingle.mockResolvedValueOnce({ data: unverifiedProfile, error: null })

      const result = await getCachedPublicOrganizer('org_unverified')
      expect(result).toBeNull()
    })

    it('returns null if organizer is not found or id is blank', async () => {
      expect(await getCachedPublicOrganizer('')).toBeNull()

      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
      expect(await getCachedPublicOrganizer('nonexistent')).toBeNull()
    })

    it('fetches public venues scoped by campusId', async () => {
      const sampleVenues = [
        { id: 'v1', name: 'Main Hall', campus_id: 'c1', is_active: true },
      ]
      mockOrder.mockResolvedValueOnce({ data: sampleVenues, error: null })

      const result = await getCachedPublicVenues('c1')
      expect(mockSupabase.from).toHaveBeenCalledWith('campus_venues')
      expect(mockEq).toHaveBeenCalledWith('is_active', true)
      expect(mockEq).toHaveBeenCalledWith('campus_id', 'c1')
      expect(result).toEqual(sampleVenues)
    })

    it('fetches all active public venues when no campusId is provided', async () => {
      const sampleVenues = [
        { id: 'v1', name: 'Main Auditorium', is_active: true },
      ]
      mockOrder.mockResolvedValueOnce({ data: sampleVenues, error: null })

      const result = await getCachedPublicVenues()
      expect(mockSupabase.from).toHaveBeenCalledWith('campus_venues')
      expect(mockEq).toHaveBeenCalledWith('is_active', true)
      expect(result).toEqual(sampleVenues)
    })

    it('returns public event categories', async () => {
      const result = await getCachedEventCategories()
      expect(result).toEqual(EVENT_CATEGORIES)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Authorization and Privacy Boundaries', () => {
    it('only exports safe public caching functions, never cross-user event lists or tickets', async () => {
      const publicCacheExports = await import('@/lib/cache/public-cache')
      const exportedKeys = Object.keys(publicCacheExports)

      // Expected public exports
      expect(exportedKeys).toContain('getCachedActiveCampuses')
      expect(exportedKeys).toContain('getCachedPublicOrganizer')
      expect(exportedKeys).toContain('getCachedPublicVenues')
      expect(exportedKeys).toContain('getCachedEventCategories')

      // Must NOT contain event listing cache, tickets, attendees, registrations, or users
      expect(exportedKeys).not.toContain('getCachedEvents')
      expect(exportedKeys).not.toContain('getCachedEventListings')
      expect(exportedKeys).not.toContain('getCachedTickets')
      expect(exportedKeys).not.toContain('getCachedAttendees')
      expect(exportedKeys).not.toContain('getCachedRegistrations')
      expect(exportedKeys).not.toContain('getCachedUserProfiles')
    })

    it('strips private or unexpected fields from organizer profiles', async () => {
      const rawOrganizerWithPrivateFields = {
        id: 'org_secure',
        full_name: 'Verified Robotics Club',
        avatar_url: 'https://example.com/robotics.png',
        bio: 'Building autonomous rovers',
        website_url: 'https://robotics.edu',
        instagram_handle: 'robotics',
        contact_email: 'team@robotics.edu',
        campus_id: 'campus_main',
        college: 'Engineering',
        department: 'ECE',
        is_verified: true,
        // Sensitive fields that must NOT be present in output
        email: 'internal_private_admin@robotics.edu',
        user_metadata: { role: 'superadmin' },
        password_hash: '$2b$12$...',
        stripe_account_id: 'acct_12345',
      }
      mockMaybeSingle.mockResolvedValueOnce({ data: rawOrganizerWithPrivateFields, error: null })

      const result = await getCachedPublicOrganizer('org_secure')
      expect(result).toBeDefined()
      expect(result).not.toBeNull()
      expect(result).not.toHaveProperty('password_hash')
      expect(result).not.toHaveProperty('stripe_account_id')
      expect(result).not.toHaveProperty('user_metadata')
      expect(result?.full_name).toBe('Verified Robotics Club')
    })
  })
})

