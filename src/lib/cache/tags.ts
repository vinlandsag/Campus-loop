/**
 * Centralized Cache Tags for Public/Shared Data
 *
 * Used with Next.js 16 unstable_cache and revalidateTag.
 * Only truly public, non-user-specific entities are tagged and cached here.
 */
export const CACHE_TAGS = {
  campuses: 'campuses',
  activeCampuses: 'active-campuses',
  organizers: 'organizers-public',
  organizer: (id: string) => `organizer-${id}`,
  venues: 'venues',
  campusVenues: (campusId: string) => `venues-${campusId}`,
  categories: 'event-categories',
} as const
