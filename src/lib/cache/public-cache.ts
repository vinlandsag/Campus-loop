import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/public'
import { EVENT_CATEGORIES, type EventCategory } from '@/lib/constants'
import { CACHE_TAGS } from './tags'
import type { Campus, CampusVenue } from '@/types'

/**
 * Public verified organizer summary.
 * Strictly limited to public directory fields for verified organizers only.
 * Guaranteed zero leakage of private settings, draft events, or attendee lists.
 */
export interface PublicOrganizerSummary {
  id: string
  full_name: string
  avatar_url: string | null
  bio: string | null
  website_url: string | null
  instagram_handle: string | null
  contact_email: string | null
  campus_id: string | null
  college: string | null
  department: string | null
  is_verified: boolean
}

/**
 * 1. Active Campus List Cache
 * Shared across all visitors and authenticated users.
 * Invalidate when an admin adds, edits, activates, or deactivates a campus.
 */
export const getCachedActiveCampuses = unstable_cache(
  async (): Promise<Campus[]> => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('campuses')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error || !data) {
      console.error('Error fetching active campuses for public cache:', error)
      return []
    }

    return data as unknown as Campus[]
  },
  ['active-campuses-list'],
  {
    tags: [CACHE_TAGS.campuses, CACHE_TAGS.activeCampuses],
    revalidate: 3600, // 1 hour TTL fallback
  }
)

/**
 * 2. Public Verified Organizer Summary Cache
 * Fetches public verified organizer profile from the organizer_profiles view.
 * Guaranteed to return null for unverified organizers or regular users.
 * Invalidate when an admin approves, revokes, or suspends an organizer, or when the organizer updates their public bio.
 */
export function getCachedPublicOrganizer(
  organizerId: string
): Promise<PublicOrganizerSummary | null> {
  return unstable_cache(
    async (): Promise<PublicOrganizerSummary | null> => {
      if (!organizerId) return null
      const supabase = createPublicClient()
      const { data, error } = await supabase
        .from('organizer_profiles')
        .select(
          'id, full_name, avatar_url, bio, website_url, instagram_handle, contact_email, campus_id, college, department, is_verified'
        )
        .eq('id', organizerId)
        .maybeSingle()

      if (error || !data || !data.is_verified) {
        return null
      }

      return {
        id: data.id || organizerId,
        full_name: data.full_name || 'Campus Organizer',
        avatar_url: data.avatar_url,
        bio: data.bio,
        website_url: data.website_url,
        instagram_handle: data.instagram_handle,
        contact_email: data.contact_email,
        campus_id: data.campus_id,
        college: data.college,
        department: data.department,
        is_verified: Boolean(data.is_verified),
      }
    },
    ['public-verified-organizer', organizerId],
    {
      tags: [CACHE_TAGS.organizers, CACHE_TAGS.organizer(organizerId)],
      revalidate: 3600, // 1 hour TTL fallback
    }
  )()
}

/**
 * 3. Public Venue Information Cache
 * Fetches active public campus venues, optionally scoped by campusId.
 * Invalidate when an admin or organizer modifies venue information.
 */
export function getCachedPublicVenues(
  campusId?: string
): Promise<CampusVenue[]> {
  const keyParts = campusId ? ['public-venues-list', campusId] : ['public-venues-list', 'all']
  const tags = campusId
    ? [CACHE_TAGS.venues, CACHE_TAGS.campusVenues(campusId)]
    : [CACHE_TAGS.venues]

  return unstable_cache(
    async (): Promise<CampusVenue[]> => {
      const supabase = createPublicClient()
      let query = supabase
        .from('campus_venues')
        .select('*')
        .eq('is_active', true)

      if (campusId) {
        query = query.eq('campus_id', campusId)
      }

      const { data, error } = await query.order('name', { ascending: true })
      if (error || !data) {
        console.error('Error fetching public venues for cache:', error)
        return []
      }

      return data as CampusVenue[]
    },
    keyParts,
    {
      tags,
      revalidate: 3600, // 1 hour TTL fallback
    }
  )()
}

/**
 * 4. Public Event Category Definitions Cache
 * Shared public list of event categories.
 */
export const getCachedEventCategories = unstable_cache(
  async (): Promise<readonly { readonly value: EventCategory; readonly label: string }[]> => {
    return EVENT_CATEGORIES
  },
  ['public-event-categories'],
  {
    tags: [CACHE_TAGS.categories],
    revalidate: 86400, // 24 hours TTL
  }
)
