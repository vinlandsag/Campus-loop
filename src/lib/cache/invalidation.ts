import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from './tags'

/**
 * Invalidate the active campus cache.
 * Must be called whenever an admin creates, updates, deletes, or changes campus domains/active status.
 */
export function invalidateCampusCache(): void {
  try {
    revalidateTag(CACHE_TAGS.campuses, 'max')
    revalidateTag(CACHE_TAGS.activeCampuses, 'max')
  } catch (err) {
    console.warn('Failed to invalidate campus cache:', err)
  }
}

/**
 * Invalidate public verified organizer summaries.
 * Must be called whenever an admin approves, rejects, suspends, unsuspends, or revokes an organizer,
 * or when an organizer updates their public profile.
 */
export function invalidateOrganizerCache(organizerId?: string): void {
  try {
    revalidateTag(CACHE_TAGS.organizers, 'max')
    if (organizerId) {
      revalidateTag(CACHE_TAGS.organizer(organizerId), 'max')
    }
  } catch (err) {
    console.warn('Failed to invalidate organizer cache:', err)
  }
}

/**
 * Invalidate public venue information.
 * Must be called whenever an admin or organizer creates, updates, or deletes a venue.
 */
export function invalidateVenueCache(campusId?: string): void {
  try {
    revalidateTag(CACHE_TAGS.venues, 'max')
    if (campusId) {
      revalidateTag(CACHE_TAGS.campusVenues(campusId), 'max')
    }
  } catch (err) {
    console.warn('Failed to invalidate venue cache:', err)
  }
}

/**
 * Invalidate public event category definitions.
 */
export function invalidateCategoriesCache(): void {
  try {
    revalidateTag(CACHE_TAGS.categories, 'max')
  } catch (err) {
    console.warn('Failed to invalidate categories cache:', err)
  }
}
