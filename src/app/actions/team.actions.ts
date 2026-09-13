'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getEventUserRole, canManageTeam } from '@/lib/auth/teams'
import type { EventTeamMember, EventTeamRole } from '@/types'

/**
 * Fetch all team members for an event, including the creator/owner.
 */
export async function getEventTeam(eventId: string): Promise<{
  success: boolean
  team: EventTeamMember[]
  currentUserRole: EventTeamRole | null
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, team: [], currentUserRole: null, error: 'Unauthorized' }
  }

  const currentUserRole = await getEventUserRole(eventId, user.id)
  if (!currentUserRole) {
    return { success: false, team: [], currentUserRole: null, error: 'You are not a member of this event team.' }
  }

  // Fetch event organizer
  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id, created_at')
    .eq('id', eventId)
    .single()

  if (!event) {
    return { success: false, team: [], currentUserRole: null, error: 'Event not found.' }
  }

  const teamList: EventTeamMember[] = []

  // 1. Primary Owner
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('id', event.organizer_id)
    .maybeSingle()

  teamList.push({
    id: `owner-${event.organizer_id}`,
    event_id: eventId,
    user_id: event.organizer_id,
    role: 'owner',
    created_at: event.created_at,
    user: {
      display_name: ownerProfile?.full_name || 'Primary Organizer',
      avatar_url: ownerProfile?.avatar_url,
    },
  })

  // 2. Fetch assigned team members
  const { data: members } = await supabase
    .from('event_team_members')
    .select('id, event_id, user_id, role, invited_by, created_at, updated_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  if (members && members.length > 0) {
    const memberUserIds = members.map((m) => m.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', memberUserIds)

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))

    for (const m of members) {
      if (m.user_id === event.organizer_id) continue // skip duplicate owner
      const p = profileMap.get(m.user_id)
      teamList.push({
        id: m.id,
        event_id: m.event_id,
        user_id: m.user_id,
        role: m.role as EventTeamRole,
        invited_by: m.invited_by,
        created_at: m.created_at,
        updated_at: m.updated_at,
        user: {
          display_name: p?.full_name || 'Team Member',
          avatar_url: p?.avatar_url,
        },
      })
    }
  }

  return { success: true, team: teamList, currentUserRole }
}

/**
 * Add a new team member to an event by email or user ID.
 */
export async function addEventTeamMember(
  eventId: string,
  emailOrUserId: string,
  role: EventTeamRole
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const callerRole = await getEventUserRole(eventId, user.id)
  if (!canManageTeam(callerRole)) {
    return { success: false, error: 'Only event owners can invite or manage team members.' }
  }

  const targetInput = emailOrUserId.trim()
  if (!targetInput) {
    return { success: false, error: 'Please provide a valid user email or ID.' }
  }

  // Look up user by email or ID in profiles table
  let targetUserId: string | null = null
  const isEmail = targetInput.includes('@')

  if (isEmail) {
    // Try matching email in profiles or auth
    const { data: matchedProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', targetInput)
      .maybeSingle()

    targetUserId = matchedProfile?.id ?? null
  } else {
    // Treat as user UUID
    targetUserId = targetInput
  }

  if (!targetUserId) {
    return {
      success: false,
      error: `Could not find any CampusLoop account for "${targetInput}". Please check the spelling or ask them to sign up first.`,
    }
  }

  // Ensure not adding the primary organizer
  const { data: event } = await supabase
    .from('events')
    .select('organizer_id')
    .eq('id', eventId)
    .single()

  if (event?.organizer_id === targetUserId) {
    return { success: false, error: 'This user is already the primary event owner.' }
  }

  // Check if already in team
  const { data: existing } = await supabase
    .from('event_team_members')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'This user is already a member of this event team.' }
  }

  const { error: insertErr } = await supabase
    .from('event_team_members')
    .insert({
      event_id: eventId,
      user_id: targetUserId,
      role,
      invited_by: user.id,
    } as unknown as Record<string, unknown>)

  if (insertErr) {
    console.error('Failed to add team member:', insertErr)
    return { success: false, error: insertErr.message }
  }

  revalidatePath(`/dashboard/events/${eventId}/team`)
  revalidatePath(`/dashboard/events/${eventId}/participants`)

  return { success: true }
}

/**
 * Update an existing team member's role.
 */
export async function updateEventTeamMemberRole(
  eventId: string,
  memberId: string,
  newRole: EventTeamRole
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const callerRole = await getEventUserRole(eventId, user.id)
  if (!canManageTeam(callerRole)) {
    return { success: false, error: 'Only event owners can modify team roles.' }
  }

  const { error } = await supabase
    .from('event_team_members')
    .update({
      role: newRole,
      updated_at: new Date().toISOString(),
    } as unknown as Record<string, unknown>)
    .eq('id', memberId)
    .eq('event_id', eventId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/events/${eventId}/team`)
  return { success: true }
}

/**
 * Remove a team member from an event.
 */
export async function removeEventTeamMember(
  eventId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const callerRole = await getEventUserRole(eventId, user.id)
  if (!canManageTeam(callerRole)) {
    return { success: false, error: 'Only event owners can remove team members.' }
  }

  const { error } = await supabase
    .from('event_team_members')
    .delete()
    .eq('id', memberId)
    .eq('event_id', eventId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/events/${eventId}/team`)
  return { success: true }
}
