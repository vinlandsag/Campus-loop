'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  ActionResult,
  FriendDetails,
  UserSocialPreferences,
  AttendanceVisibility,
} from '@/types'

/**
 * Send a friend request to a student by their email address or user ID.
 */
export async function sendFriendRequest(
  targetIdentifier: string
): Promise<ActionResult<{ friendshipId: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to send friend requests.' }
  }

  const cleanIdentifier = targetIdentifier.trim().toLowerCase()
  if (!cleanIdentifier) {
    return { success: false, error: 'Please provide a valid email or student ID.' }
  }

  // Look up target profile by email or id
  let query = supabase.from('profiles').select('id, full_name, email, campus_id')
  if (cleanIdentifier.includes('@')) {
    query = query.eq('email', cleanIdentifier)
  } else {
    query = query.eq('id', cleanIdentifier)
  }

  const { data: targetProfile, error: profileErr } = await query.maybeSingle()

  if (profileErr || !targetProfile) {
    return {
      success: false,
      error: 'No student found with that email address.',
    }
  }

  if (targetProfile.id === user.id) {
    return { success: false, error: 'You cannot send a friend request to yourself.' }
  }

  // Check if target user allows friend requests
  const { data: targetPrefs } = await supabase
    .from('user_social_preferences')
    .select('allow_friend_requests')
    .eq('user_id', targetProfile.id)
    .maybeSingle()

  if (targetPrefs && targetPrefs.allow_friend_requests === false) {
    return {
      success: false,
      error: 'This student is not accepting new friend requests.',
    }
  }

  // Check existing relationship in either direction
  const { data: existingFriendship } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status')
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${targetProfile.id}),and(user_id.eq.${targetProfile.id},friend_id.eq.${user.id})`
    )
    .maybeSingle()

  if (existingFriendship) {
    if (existingFriendship.status === 'accepted') {
      return { success: false, error: 'You are already friends with this student.' }
    }
    if (existingFriendship.status === 'blocked') {
      return { success: false, error: 'Unable to send friend request.' }
    }
    if (existingFriendship.status === 'pending') {
      if (existingFriendship.user_id === user.id) {
        return { success: false, error: 'You have already sent a friend request to this student.' }
      } else {
        // If the other person already sent a request to this user, auto-accept it!
        const { error: acceptErr } = await supabase
          .from('friendships')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', existingFriendship.id)

        if (acceptErr) {
          return { success: false, error: acceptErr.message }
        }

        revalidatePath('/friends')
        revalidatePath('/following')
        return { success: true, data: { friendshipId: existingFriendship.id } }
      }
    }
  }

  // Insert pending request
  const { data: inserted, error: insertErr } = await supabase
    .from('friendships')
    .insert({
      user_id: user.id,
      friend_id: targetProfile.id,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    const errorMsg = insertErr?.message || insertErr?.code || 'Could not send friend request.'
    console.error('Failed to send friend request:', errorMsg)
    if (insertErr?.code === 'PGRST205' || errorMsg.includes('schema cache')) {
      return {
        success: false,
        error: 'Database migration required: Table public.friendships not found. Please apply 20260912140000_phase12_social_discovery_and_privacy.sql.',
      }
    }
    return { success: false, error: errorMsg }
  }

  revalidatePath('/friends')
  return { success: true, data: { friendshipId: inserted.id } }
}

/**
 * Respond to an incoming friend request (accept or decline).
 */
export async function respondToFriendRequest(
  friendshipId: string,
  action: 'accept' | 'decline'
): Promise<ActionResult<{ status: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify friendship exists and recipient is current user
  const { data: friendship, error: findErr } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status')
    .eq('id', friendshipId)
    .maybeSingle()

  if (findErr || !friendship) {
    return { success: false, error: 'Friend request not found.' }
  }

  if (friendship.friend_id !== user.id) {
    return { success: false, error: 'Only the recipient can respond to this request.' }
  }

  if (action === 'accept') {
    const { error: updateErr } = await supabase
      .from('friendships')
      .update({
        status: 'accepted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', friendshipId)

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }
  } else {
    // Decline deletes or marks as declined
    const { error: delErr } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)

    if (delErr) {
      return { success: false, error: delErr.message }
    }
  }

  revalidatePath('/friends')
  revalidatePath('/following')
  revalidatePath('/events')

  return { success: true, data: { status: action === 'accept' ? 'accepted' : 'declined' } }
}

/**
 * Remove an existing mutual friendship.
 */
export async function removeFriend(
  targetUserId: string
): Promise<ActionResult<{ removed: boolean }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`
    )

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/friends')
  revalidatePath('/following')
  revalidatePath('/events')

  return { success: true, data: { removed: true } }
}

/**
 * Block a user (cannot send friend requests, cannot see shared attendance).
 */
export async function blockUser(
  targetUserId: string
): Promise<ActionResult<{ blocked: boolean }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  if (user.id === targetUserId) {
    return { success: false, error: 'You cannot block yourself.' }
  }

  // Check if a friendship record already exists
  const { data: existing } = await supabase
    .from('friendships')
    .select('id')
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`
    )
    .maybeSingle()

  if (existing) {
    const { error: updateErr } = await supabase
      .from('friendships')
      .update({
        user_id: user.id,
        friend_id: targetUserId,
        status: 'blocked',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }
  } else {
    const { error: insertErr } = await supabase.from('friendships').insert({
      user_id: user.id,
      friend_id: targetUserId,
      status: 'blocked',
    })

    if (insertErr) {
      return { success: false, error: insertErr.message }
    }
  }

  revalidatePath('/friends')
  revalidatePath('/following')
  revalidatePath('/events')

  return { success: true, data: { blocked: true } }
}

/**
 * Get the list of accepted mutual friends for the authenticated student.
 */
export async function getFriendsList(): Promise<ActionResult<FriendDetails[]>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: friendships, error: friendErr } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status, created_at')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false })

  if (friendErr) {
    const errorMsg = friendErr.message || friendErr.code || 'Failed to query friendships'
    console.error('Failed to get friends list:', errorMsg)
    if (friendErr.code === 'PGRST205' || errorMsg.includes('schema cache')) {
      return {
        success: false,
        error: 'Database migration required: Table public.friendships not found. Please apply 20260912140000_phase12_social_discovery_and_privacy.sql.',
      }
    }
    return { success: false, error: errorMsg }
  }

  if (!friendships || friendships.length === 0) {
    return { success: true, data: [] }
  }

  const friendUserIds = friendships.map((f) =>
    f.user_id === user.id ? f.friend_id : f.user_id
  )

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, campus_id')
    .in('id', friendUserIds)

  const profileMap = new Map<string, { full_name: string; avatar_url: string | null; campus_id: string | null }>()
  if (profiles) {
    for (const p of profiles) {
      profileMap.set(p.id, {
        full_name: p.full_name || 'Campus Student',
        avatar_url: p.avatar_url,
        campus_id: p.campus_id,
      })
    }
  }

  const friends: FriendDetails[] = friendships.map((f) => {
    const friendUid = f.user_id === user.id ? f.friend_id : f.user_id
    const prof = profileMap.get(friendUid)

    return {
      friendship_id: f.id,
      friend_user_id: friendUid,
      full_name: prof?.full_name || 'Student',
      avatar_url: prof?.avatar_url || null,
      campus_name: null,
      status: f.status,
      is_requester: f.user_id === user.id,
      since: f.created_at,
    }
  })

  return { success: true, data: friends }
}

/**
 * Get pending friend requests (both incoming and outgoing).
 */
export async function getPendingFriendRequests(): Promise<
  ActionResult<{
    incoming: FriendDetails[]
    outgoing: FriendDetails[]
  }>
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: friendships, error: friendErr } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, status, created_at')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (friendErr) {
    const errorMsg = friendErr.message || friendErr.code || 'Failed to query pending requests'
    console.error('Failed to get pending requests:', errorMsg)
    if (friendErr.code === 'PGRST205' || errorMsg.includes('schema cache')) {
      return {
        success: false,
        error: 'Database migration required: Table public.friendships not found. Please apply 20260912140000_phase12_social_discovery_and_privacy.sql.',
      }
    }
    return { success: false, error: errorMsg }
  }

  if (!friendships || friendships.length === 0) {
    return { success: true, data: { incoming: [], outgoing: [] } }
  }

  const targetIds = friendships.map((f) =>
    f.user_id === user.id ? f.friend_id : f.user_id
  )

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, campus_id')
    .in('id', targetIds)

  const profileMap = new Map<string, { full_name: string; avatar_url: string | null; campus_id: string | null }>()
  if (profiles) {
    for (const p of profiles) {
      profileMap.set(p.id, {
        full_name: p.full_name || 'Student',
        avatar_url: p.avatar_url,
        campus_id: p.campus_id,
      })
    }
  }

  const incoming: FriendDetails[] = []
  const outgoing: FriendDetails[] = []

  for (const f of friendships) {
    const isRequester = f.user_id === user.id
    const otherUid = isRequester ? f.friend_id : f.user_id
    const prof = profileMap.get(otherUid)

    const detail: FriendDetails = {
      friendship_id: f.id,
      friend_user_id: otherUid,
      full_name: prof?.full_name || 'Student',
      avatar_url: prof?.avatar_url || null,
      campus_name: null,
      status: f.status,
      is_requester: isRequester,
      since: f.created_at,
    }

    if (isRequester) {
      outgoing.push(detail)
    } else {
      incoming.push(detail)
    }
  }

  return { success: true, data: { incoming, outgoing } }
}

/**
 * Get social preferences for the authenticated student.
 */
export async function getUserSocialPreferences(): Promise<UserSocialPreferences> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const defaultPrefs: UserSocialPreferences = {
    user_id: user?.id || '',
    share_attendance_with_friends: false,
    default_attendance_visibility: 'private',
    allow_friend_requests: true,
  }

  if (!user) return defaultPrefs

  const { data: prefs } = await supabase
    .from('user_social_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!prefs) return defaultPrefs

  return {
    user_id: prefs.user_id,
    share_attendance_with_friends: prefs.share_attendance_with_friends,
    default_attendance_visibility: prefs.default_attendance_visibility as AttendanceVisibility,
    allow_friend_requests: prefs.allow_friend_requests,
    created_at: prefs.created_at,
    updated_at: prefs.updated_at,
  }
}

/**
 * Update social preferences (opt-in attendance sharing, default visibility, etc.).
 */
export async function updateUserSocialPreferences(
  input: Partial<Pick<UserSocialPreferences, 'share_attendance_with_friends' | 'default_attendance_visibility' | 'allow_friend_requests'>>
): Promise<ActionResult<UserSocialPreferences>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: updated, error } = await supabase
    .from('user_social_preferences')
    .upsert({
      user_id: user.id,
      ...input,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error || !updated) {
    return { success: false, error: error?.message || 'Could not update preferences' }
  }

  revalidatePath('/settings')
  revalidatePath('/friends')
  revalidatePath('/events')

  return {
    success: true,
    data: {
      user_id: updated.user_id,
      share_attendance_with_friends: updated.share_attendance_with_friends,
      default_attendance_visibility: updated.default_attendance_visibility as AttendanceVisibility,
      allow_friend_requests: updated.allow_friend_requests,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    },
  }
}

/**
 * Update attendance visibility on a specific registration.
 */
export async function updateRegistrationAttendanceVisibility(
  registrationId: string,
  visibility: AttendanceVisibility
): Promise<ActionResult<{ visibility: AttendanceVisibility }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('registrations')
    .update({ attendance_visibility: visibility })
    .eq('id', registrationId)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/tickets')
  revalidatePath('/events')

  return { success: true, data: { visibility } }
}
