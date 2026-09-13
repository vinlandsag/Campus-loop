'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult, ClubFollowDetails } from '@/types'

/**
 * Follow a verified campus club / organizer.
 */
export async function followClub(
  organizerId: string,
  notifyOnNewEvents: boolean = true
): Promise<ActionResult<{ isFollowing: boolean; notify: boolean }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to follow clubs.' }
  }

  if (user.id === organizerId) {
    return { success: false, error: 'You cannot follow your own organizer account.' }
  }

  // Verify target is an active verified organizer
  const { data: organizer, error: orgErr } = await supabase
    .from('organizer_profiles')
    .select('id, is_verified')
    .eq('id', organizerId)
    .maybeSingle()

  if (orgErr || !organizer || !organizer.is_verified) {
    return { success: false, error: 'Only verified campus clubs can be followed.' }
  }

  const { error } = await supabase.from('club_follows').upsert(
    {
      user_id: user.id,
      organizer_id: organizerId,
      notify_on_new_events: notifyOnNewEvents,
    },
    { onConflict: 'user_id,organizer_id' }
  )

  if (error) {
    const errorMsg = error.message || error.code || 'Failed to follow club'
    console.error('Failed to follow club:', errorMsg)
    if (error.code === 'PGRST205' || errorMsg.includes('schema cache')) {
      return {
        success: false,
        error: 'Database migration required: Table public.club_follows not found. Please apply 20260912140000_phase12_social_discovery_and_privacy.sql.',
      }
    }
    return { success: false, error: errorMsg }
  }

  revalidatePath(`/organizers/${organizerId}`)
  revalidatePath('/following')
  revalidatePath('/events')

  return {
    success: true,
    data: { isFollowing: true, notify: notifyOnNewEvents },
  }
}

/**
 * Unfollow a campus club / organizer.
 */
export async function unfollowClub(
  organizerId: string
): Promise<ActionResult<{ isFollowing: boolean }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to unfollow clubs.' }
  }

  const { error } = await supabase
    .from('club_follows')
    .delete()
    .eq('user_id', user.id)
    .eq('organizer_id', organizerId)

  if (error) {
    console.error('Failed to unfollow club:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/organizers/${organizerId}`)
  revalidatePath('/following')
  revalidatePath('/events')

  return {
    success: true,
    data: { isFollowing: false },
  }
}

/**
 * Toggle notification preference for a followed club.
 */
export async function toggleClubNotification(
  organizerId: string,
  notify: boolean
): Promise<ActionResult<{ notify: boolean }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('club_follows')
    .update({ notify_on_new_events: notify })
    .eq('user_id', user.id)
    .eq('organizer_id', organizerId)

  if (error) {
    console.error('Failed to update club follow notifications:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/following')
  revalidatePath(`/organizers/${organizerId}`)

  return { success: true, data: { notify } }
}

/**
 * Get all clubs followed by the current authenticated student.
 */
export async function getFollowedClubs(): Promise<ActionResult<ClubFollowDetails[]>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: follows, error } = await supabase
    .from('club_follows')
    .select('id, organizer_id, notify_on_new_events, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    const errorMsg = error.message || error.code || 'Failed to fetch followed clubs'
    console.error('Failed to fetch followed clubs:', errorMsg)
    if (error.code === 'PGRST205' || errorMsg.includes('schema cache')) {
      return {
        success: false,
        error: 'Database migration required: Table public.club_follows not found. Please apply 20260912140000_phase12_social_discovery_and_privacy.sql.',
      }
    }
    return { success: false, error: errorMsg }
  }

  if (!follows || follows.length === 0) {
    return { success: true, data: [] }
  }

  const orgIds = follows.map((f) => f.organizer_id)

  const { data: profiles } = await supabase
    .from('organizer_profiles')
    .select('id, full_name, avatar_url')
    .in('id', orgIds)

  const profileMap = new Map<string, { full_name: string; avatar_url: string | null }>()
  if (profiles) {
    for (const p of profiles) {
      profileMap.set(p.id, { full_name: p.full_name || 'Club Organizer', avatar_url: p.avatar_url })
    }
  }

  const results: ClubFollowDetails[] = follows.map((f) => {
    const prof = profileMap.get(f.organizer_id)
    return {
      id: f.id,
      organizer_id: f.organizer_id,
      organizer_name: prof?.full_name || 'Campus Club',
      avatar_url: prof?.avatar_url || null,
      notify_on_new_events: f.notify_on_new_events,
      created_at: f.created_at,
    }
  })

  return { success: true, data: results }
}

/**
 * Get follow state and safe aggregate count for a specific organizer.
 */
export async function getOrganizerFollowStats(organizerId: string): Promise<{
  isFollowing: boolean
  notify: boolean
  followerCount: number
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isFollowing = false
  let notify = true

  if (user) {
    const { data: follow } = await supabase
      .from('club_follows')
      .select('id, notify_on_new_events')
      .eq('user_id', user.id)
      .eq('organizer_id', organizerId)
      .maybeSingle()

    if (follow) {
      isFollowing = true
      notify = follow.notify_on_new_events
    }
  }

  // Safe aggregate follower count
  let followerCount = 0
  try {
    const { data: countData } = await supabase.rpc('get_organizer_follower_count', {
      p_organizer_id: organizerId,
    })
    if (typeof countData === 'number') {
      followerCount = countData
    }
  } catch {
    followerCount = 0
  }

  return {
    isFollowing,
    notify,
    followerCount,
  }
}
