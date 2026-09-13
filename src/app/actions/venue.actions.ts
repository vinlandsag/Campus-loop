'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCachedPublicVenues } from '@/lib/cache/public-cache'
import { invalidateVenueCache } from '@/lib/cache/invalidation'
import type { CampusVenue } from '@/types'

export async function getCampusVenues(campusId?: string): Promise<{ success: boolean; data?: CampusVenue[]; error?: string }> {
  try {
    const venues = await getCachedPublicVenues(campusId)
    return { success: true, data: venues }
  } catch (err) {
    console.error('getCampusVenues failure:', err)
    return { success: false, error: 'Failed to retrieve venues' }
  }
}

export async function createCampusVenue(input: {
  campus_id?: string | null
  name: string
  building?: string | null
  floor?: string | null
  room?: string | null
  latitude?: number | null
  longitude?: number | null
  accessibility_details?: string | null
  directions_url?: string | null
}): Promise<{ success: boolean; data?: CampusVenue; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data, error } = await supabase
      .from('campus_venues')
      .insert({
        campus_id: input.campus_id || null,
        name: input.name.trim(),
        building: input.building?.trim() || null,
        floor: input.floor?.trim() || null,
        room: input.room?.trim() || null,
        latitude: typeof input.latitude === 'number' ? input.latitude : null,
        longitude: typeof input.longitude === 'number' ? input.longitude : null,
        accessibility_details: input.accessibility_details?.trim() || null,
        directions_url: input.directions_url?.trim() || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating campus venue:', error)
      return { success: false, error: error.message }
    }

    invalidateVenueCache(input.campus_id || undefined)
    revalidatePath('/dashboard/events')
    return { success: true, data: data as CampusVenue }
  } catch (err) {
    console.error('createCampusVenue failure:', err)
    return { success: false, error: 'Failed to create venue' }
  }
}
