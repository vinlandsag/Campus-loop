'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getEventUserRole, canManageEvent } from '@/lib/auth/teams'
import type { ActionResult, EventPhoto, PhotoPrivacyPreference } from '@/types'

/**
 * Fetch all curated photos for an event gallery.
 */
export async function getEventPhotos(eventId: string): Promise<ActionResult<EventPhoto[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('event_photos')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to get event photos:', error)
    return { success: false, error: error.message }
  }

  const uploaderIds = Array.from(new Set((data || []).map((p) => p.uploaded_by)))
  let profileMap = new Map<string, { id: string; full_name: string; avatar_url: string | null }>()

  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', uploaderIds)

    if (profiles) {
      profileMap = new Map(profiles.map((p) => [p.id, p]))
    }
  }

  const photos: EventPhoto[] = (data || []).map((p) => {
    const prof = profileMap.get(p.uploaded_by)
    return {
      id: p.id,
      event_id: p.event_id,
      uploaded_by: p.uploaded_by,
      photo_url: p.photo_url,
      caption: p.caption,
      created_at: p.created_at,
      uploader: prof ? {
        id: prof.id,
        full_name: prof.full_name,
        avatar_url: prof.avatar_url,
      } : undefined,
    }
  })

  return { success: true, data: photos }
}

/**
 * Upload a curated photo to an event gallery (organizers/editors only).
 */
export async function uploadEventPhoto(
  eventId: string,
  photoUrl: string,
  caption?: string
): Promise<ActionResult<EventPhoto>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const role = await getEventUserRole(eventId, user.id)
  if (!canManageEvent(role)) {
    return { success: false, error: 'Only event owners and editors can upload gallery photos.' }
  }

  const cleanUrl = photoUrl.trim()
  if (!cleanUrl) {
    return { success: false, error: 'Photo URL is required.' }
  }

  const { data: photo, error } = await supabase
    .from('event_photos')
    .insert({
      event_id: eventId,
      uploaded_by: user.id,
      photo_url: cleanUrl,
      caption: caption?.trim() || null,
    })
    .select()
    .single()

  if (error || !photo) {
    console.error('Failed to insert event photo:', error)
    return { success: false, error: error?.message || 'Failed to upload photo.' }
  }

  revalidatePath(`/dashboard/events/${eventId}/gallery`)
  revalidatePath(`/events`)

  return {
    success: true,
    data: {
      id: photo.id,
      event_id: photo.event_id,
      uploaded_by: photo.uploaded_by,
      photo_url: photo.photo_url,
      caption: photo.caption,
      created_at: photo.created_at,
    },
  }
}

/**
 * Delete a photo from an event gallery (organizers/editors only).
 */
export async function deleteEventPhoto(
  photoId: string,
  eventId: string
): Promise<ActionResult<{ deleted: boolean }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const role = await getEventUserRole(eventId, user.id)
  if (!canManageEvent(role)) {
    return { success: false, error: 'Unauthorized to delete event photos.' }
  }

  const { error } = await supabase
    .from('event_photos')
    .delete()
    .eq('id', photoId)
    .eq('event_id', eventId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/events/${eventId}/gallery`)
  return { success: true, data: { deleted: true } }
}

/**
 * Get the current user's photo privacy preference.
 */
export async function getPhotoPrivacyPreference(): Promise<ActionResult<PhotoPrivacyPreference>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('event_photo_privacy_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Failed to get photo privacy:', error)
    return { success: false, error: error.message }
  }

  if (!data) {
    return {
      success: true,
      data: {
        id: '',
        user_id: user.id,
        opt_out_photo_appearances: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }
  }

  return {
    success: true,
    data: {
      id: data.id,
      user_id: data.user_id,
      opt_out_photo_appearances: data.opt_out_photo_appearances,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  }
}

/**
 * Update the user's photo appearance opt-out preference.
 */
export async function updatePhotoPrivacyPreference(
  optOut: boolean
): Promise<ActionResult<{ optOut: boolean }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('event_photo_privacy_preferences')
    .upsert(
      {
        user_id: user.id,
        opt_out_photo_appearances: optOut,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/settings')
  return { success: true, data: { optOut } }
}
